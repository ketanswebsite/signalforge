/**
 * Endpoint harness - HTTP client for the specs.
 *   const h = require('./harness/client');
 *   const r = await h.request('user', 'GET', '/api/trades');   // -> { status, headers, text, json }
 * Personas: 'anon' (no session), 'token' (anonymous + x-analysis-token header), or any key of
 * state.personas ('user', 'nosub', 'admin', ...). A named persona signs in once through the
 * preload's /__harness/login and keeps its session cookie.
 */
'use strict';

const fs = require('fs');
const http = require('http');

let state;
function getState() {
  if (!state) {
    if (!process.env.HARNESS_STATE) throw new Error('HARNESS_STATE is not set - run through tests/endpoints/jest.config.js');
    state = JSON.parse(fs.readFileSync(process.env.HARNESS_STATE, 'utf8'));
  }
  return state;
}

const jars = {};

function raw(method, path, { headers = {}, body, cookie } = {}) {
  const s = getState();
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = { ...headers };
    if (payload !== undefined && !h['content-type']) h['content-type'] = 'application/json';
    if (payload !== undefined) h['content-length'] = Buffer.byteLength(payload);
    if (cookie) h.cookie = cookie;
    const req = http.request(s.base + path, { method, headers: h }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch (e) { json = undefined; }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`timeout: ${method} ${path}`)));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

async function login(persona) {
  if (jars[persona]) return jars[persona];
  const s = getState();
  const email = s.personas[persona];
  if (!email) throw new Error(`unknown persona: ${persona}`);
  const r = await raw('GET', '/__harness/login?as=' + encodeURIComponent(email));
  if (r.status !== 200) throw new Error(`login ${persona} failed: ${r.status} ${r.text.slice(0, 200)}`);
  const setCookie = [].concat(r.headers['set-cookie'] || []);
  jars[persona] = setCookie.map(c => c.split(';')[0]).join('; ');
  return jars[persona];
}

async function request(persona, method, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  let cookie;
  if (persona === 'token') headers['x-analysis-token'] = getState().token;
  else if (persona !== 'anon') cookie = await login(persona);
  return raw(method, path, { ...opts, headers, cookie });
}

/** Replace {fact} placeholders in a path with the ids global-setup looked up. */
function fill(path) {
  const facts = getState().facts;
  return path.replace(/\{(\w+)\}/g, (m, k) => {
    if (facts[k] === undefined || facts[k] === '') throw new Error(`no fact ${k} for ${path}`);
    return encodeURIComponent(facts[k]);
  });
}

module.exports = { request, login, fill, state: getState };
