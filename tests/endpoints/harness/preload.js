/**
 * Endpoint-harness preload:  node -r tests/endpoints/harness/preload.js server.js
 *
 * Runs before server.js, only in the harness process that global-setup.js starts from a git-archive export
 * of the commit under test. It guarantees:
 *   1. The environment is the harness one, or it refuses to start (exit 97): a local sf_harness_* database,
 *      no bot token, Gemini, Stripe or VAPID keys, AUTO_EXECUTE=false, CONVICTION_SWEEP=false, no .env in cwd,
 *      not production, and ADMIN_EMAIL a harness persona (.invalid), so the admin is never a real account.
 *   2. node-cron is inert: every schedule() returns a no-op task, so no job ever fires. That includes the
 *      every-minute exit monitor, the 7 AM scan and the monthly sweep.
 *   3. Egress guard: any TCP connect to a host other than loopback is refused and counted. Unix sockets are
 *      allowed.
 *   4. Yahoo chart requests for symbols that have a fixture are answered from $HARNESS_FIXTURES/yahoo/.
 *   5. Route recorder: after listen, every registered route goes to $HARNESS_ROUTES_OUT.
 *   6. Test login: GET /__harness/login?as=<email> is registered just before routes/auth.js, which puts it
 *      after the session and passport middleware and before the /api gate. It exists only here, only with
 *      HARNESS_LOGIN=1.
 *   7. SIGTERM and SIGINT exit the process.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');

const CWD = process.cwd();
const log = (...a) => console.log('[HARNESS]', ...a);
const fatal = (msg) => { console.error('[HARNESS] refusing to start: ' + msg); process.exit(97); };

// ---------------------------------------------------------------- 1. environment invariants
if (process.env.NODE_ENV === 'production' || process.env.RENDER) fatal('production environment');
if (fs.existsSync(path.join(CWD, '.env'))) fatal('.env present in cwd - dotenv would load real credentials; run from a git-archive export');
let dbUrl;
try { dbUrl = new URL(process.env.DATABASE_URL || ''); } catch (e) { fatal('DATABASE_URL missing or unparsable'); }
if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(dbUrl.hostname)) fatal('DATABASE_URL must point at the local Postgres');
if (!/^\/sf_harness_[a-z0-9_]+$/.test(dbUrl.pathname)) fatal('DATABASE_URL must name a scratch sf_harness_* database');
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'GEMINI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'ADMIN_EMAILS', 'RENDER_GIT_COMMIT']) {
  if (process.env[k]) fatal(k + ' must be empty in the harness');
}
if (process.env.AUTO_EXECUTE !== 'false') fatal('AUTO_EXECUTE must be false');
if (process.env.CONVICTION_SWEEP !== 'false') fatal('CONVICTION_SWEEP must be false');
if (!/^[^@\s]+@[^@\s]+\.invalid$/.test(process.env.ADMIN_EMAIL || '')) fatal('ADMIN_EMAIL must be a harness persona on the .invalid TLD');
const port = String(process.env.PORT || '');
if (process.env.BASE_URL !== 'http://127.0.0.1:' + port) fatal('BASE_URL must be http://127.0.0.1:$PORT');

// ---------------------------------------------------------------- 7. signals really stop the process
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { log('exit on ' + sig); process.exit(0); });

// ---------------------------------------------------------------- 2. node-cron stub
const cronPath = require.resolve('node-cron', { paths: [CWD] });
const cron = require(cronPath);
let intercepted = 0;
function inertTask(expression) {
  const task = { expression, __harnessStub: true, start() {}, stop() {}, destroy() {}, execute() {}, getStatus() { return 'stopped'; } };
  return new Proxy(task, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : () => undefined)) });
}
function stubSchedule(expression) {
  intercepted += 1;
  log(`cron suppressed #${intercepted}: ${expression}`);
  return inertTask(expression);
}
for (const target of [cron, cron.nodeCron, cron.default].filter(Boolean)) {
  target.schedule = stubSchedule;
  target.createTask = stubSchedule;
}
log('cron stub active');

// ---------------------------------------------------------------- 3. egress guard
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);
const blocked = [];
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function harnessConnect(...args) {
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  let host; let portNo; let socketPath;
  if (first && typeof first === 'object') { host = first.host; portNo = first.port; socketPath = first.path; }
  else if (typeof first === 'string' && Number.isNaN(Number(first))) { socketPath = first; }
  else { portNo = first; host = typeof args[1] === 'string' ? args[1] : 'localhost'; }
  if (socketPath) return originalConnect.apply(this, args);
  const h = String(host || 'localhost').replace(/^\[|\]$/g, '');
  if (!LOOPBACK.has(h)) {
    const err = Object.assign(new Error(`[HARNESS] egress blocked: ${h}:${portNo}`), { code: 'EHARNESSEGRESS' });
    blocked.push(`${h}:${portNo}`);
    console.error(err.message);
    process.nextTick(() => this.destroy(err));
    return this;
  }
  return originalConnect.apply(this, args);
};
process.on('exit', () => log(`egress attempts blocked: ${blocked.length}` + (blocked.length ? ' -> ' + [...new Set(blocked)].join(', ') : '')));

// ---------------------------------------------------------------- 4. Yahoo chart fixtures
const FIXTURES = process.env.HARNESS_FIXTURES;
if (FIXTURES) {
  const axios = require(require.resolve('axios', { paths: [CWD] }));
  axios.interceptors.request.use((config) => {
    let url;
    try { url = new URL(config.url); } catch (e) { return config; }
    if (/(^|\.)finance\.yahoo\.com$/.test(url.hostname) && url.pathname.startsWith('/v8/finance/chart/')) {
      const symbol = decodeURIComponent(url.pathname.split('/').pop());
      const file = path.join(FIXTURES, 'yahoo', symbol.replace(/[^A-Za-z0-9._-]/g, '_') + '.json');
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        config.adapter = async () => ({ data, status: 200, statusText: 'OK', headers: {}, config, request: {} });
      }
    }
    return config;
  });
  log('Yahoo chart fixtures from ' + FIXTURES);
}

// ---------------------------------------------------------------- 5. route recorder + 6. test login
const expressDir = path.dirname(require.resolve('express/package.json', { paths: [CWD] }));
const express = require(expressDir);
const Router = require(require.resolve('router', { paths: [expressDir] }));

const originalUse = Router.prototype.use;
Router.prototype.use = function harnessUse(first, ...rest) {
  const before = this.stack.length;
  const out = originalUse.call(this, first, ...rest);
  const mountPath = (typeof first === 'string' || Array.isArray(first)) ? first : '/';
  for (let i = before; i < this.stack.length; i++) this.stack[i].__mountPath = mountPath;
  return out;
};

const originalAppUse = express.application.use;
let loginInstalled = false;
express.application.use = function harnessAppUse(...args) {
  // Forward the caller's exact arguments: express flattens `arguments`, so a padded undefined would become a handler.
  const [first, second] = args;
  const isAuthRoutesMount = first === '/' && typeof second === 'function' && Array.isArray(second.stack) && !loginInstalled;
  if (isAuthRoutesMount && process.env.HARNESS_LOGIN === '1') {
    loginInstalled = true;
    this.get('/__harness/login', (req, res, next) => {
      const email = String(req.query.as || '').trim().toLowerCase();
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(email)) return res.status(400).json({ error: 'as=<email> required' });
      if (typeof req.login !== 'function') return res.status(500).json({ error: 'passport not initialised' });
      req.login({ id: 'harness-' + email, email, name: 'Harness ' + email.split('@')[0], picture: null },
        (err) => (err ? next(err) : res.json({ ok: true, email })));
    });
    log('test login route installed before routes/auth.js');
  }
  return originalAppUse.apply(this, args);
};

function joinPath(prefix, p) {
  const s = (prefix + '/' + p).replace(/\/+/g, '/');
  return s.length > 1 ? s.replace(/\/$/, '') : s;
}
function walk(stack, prefix, out) {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter(m => m !== '_all').map(m => m.toUpperCase());
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) for (const method of (methods.length ? methods : ['ALL'])) {
        out.push({ method, path: joinPath(prefix, p) });
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      walk(layer.handle.stack, joinPath(prefix, typeof layer.__mountPath === 'string' ? layer.__mountPath : '/'), out);
    }
  }
}
const originalListen = express.application.listen;
express.application.listen = function harnessListen(...args) {
  const app = this;
  const server = originalListen.apply(app, args);
  setImmediate(() => {
    const routes = [];
    walk(app.router.stack, '', routes);
    const report = { cronStubHolds: require(cronPath).schedule === stubSchedule, cronIntercepted: intercepted, loginInstalled, routes };
    if (!report.cronStubHolds) { console.error('[HARNESS] node-cron stub was replaced - aborting'); process.exit(98); }
    if (process.env.HARNESS_ROUTES_OUT) fs.writeFileSync(process.env.HARNESS_ROUTES_OUT, JSON.stringify(report, null, 1));
    log(`listening; ${routes.length} routes recorded; cron intercepted ${intercepted}`);
  });
  return server;
};
