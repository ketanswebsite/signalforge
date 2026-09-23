/**
 * Endpoint harness - jest globalSetup.
 *
 * Run from a git-archive export of the commit under test (no .env there; the preload refuses otherwise):
 *   git archive <sha> | tar -x -C <dir>; ln -s <repo>/node_modules <dir>/node_modules; cd <dir>; npm run test:endpoints
 *
 * 1. A scratch database sf_harness_<pid>_<n> on the local Postgres. Its schema is copied from
 *    HARNESS_SCHEMA_DB (default: the local dev DB "signalforge", schema only, plus the schema_migrations and
 *    subscription_plans rows). The server's own boot DDL then brings it up to the commit under test.
 * 2. seed.sql: personas on the reserved .invalid TLD, fake HARNESS* symbols, one of each kind of row.
 * 3. Yahoo chart fixtures for the fake symbols, so no request leaves the machine.
 * 4. server.js starts under the preload with an explicit environment: nothing is inherited from the shell.
 * 5. Ready means: the preload reports listening, the startup maintenance has finished, and /health answers.
 * The state (URL, token, personas, seeded ids) goes to a JSON file named in HARNESS_STATE.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const HARNESS = __dirname;

function pgBin(name) {
  for (const dir of [process.env.PG_BIN, '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', '/usr/bin']) {
    if (dir && fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  }
  return name;
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} ${args.join(' ')} failed: ${(r.stderr || '').slice(0, 800)}`);
  return r.stdout;
}
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}
function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', () => resolve(0));
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function writeYahooFixtures(dir) {
  const out = path.join(dir, 'yahoo');
  fs.mkdirSync(out, { recursive: true });
  const symbols = { 'HARNESS.L': 100, 'HARNESSP.L': 100, 'HARNESSH.L': 101, 'HARNESSD.L': 100, 'HARNESSB.L': 54 };
  for (const [symbol, last] of Object.entries(symbols)) {
    const bars = [];
    const d = new Date(); d.setUTCHours(8, 0, 0, 0);
    while (bars.length < 90) {
      d.setUTCDate(d.getUTCDate() - 1);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      bars.unshift(Math.floor(d.getTime() / 1000));
    }
    const open = [], high = [], low = [], close = [], volume = [];
    let price = last * 0.9;
    bars.forEach((t, i) => {
      const drift = (last - price) / (90 - i);
      const o = price; const c = +(price + drift + Math.sin(i) * 0.4).toFixed(4);
      open.push(+o.toFixed(4)); close.push(c);
      high.push(+(Math.max(o, c) + 0.5).toFixed(4)); low.push(+(Math.min(o, c) - 0.5).toFixed(4)); volume.push(100000 + i * 10);
      price = c;
    });
    close[close.length - 1] = last;
    const body = { chart: { result: [{
      meta: { symbol, currency: 'GBp', regularMarketPrice: last, previousClose: close[close.length - 2], chartPreviousClose: close[close.length - 2], regularMarketTime: bars[bars.length - 1] },
      timestamp: bars, indicators: { quote: [{ open, high, low, close, volume }], adjclose: [{ adjclose: close.slice() }] } }], error: null } };
    fs.writeFileSync(path.join(out, symbol + '.json'), JSON.stringify(body));
  }
}

async function setup(ctx) {
  if (fs.existsSync(path.join(ROOT, '.env'))) {
    throw new Error('The endpoint harness runs from a git-archive export (no .env). See tests/endpoints/harness/global-setup.js.');
  }
  const user = os.userInfo().username;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-harness-'));
  const db = `sf_harness_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  ctx.db = db; ctx.work = work;
  const dbUrl = `postgres://${user}@127.0.0.1:5432/${db}`;
  const schemaDb = process.env.HARNESS_SCHEMA_DB || 'signalforge';
  const psql = pgBin('psql');

  // ---- 1. database
  run(pgBin('createdb'), [db]);
  run(psql, ['-q', '-d', db, '-c', `ALTER DATABASE ${db} SET timezone TO 'UTC'`]);
  const schema = run(pgBin('pg_dump'), ['--schema-only', '--no-owner', '--no-privileges', schemaDb]);
  run(psql, ['-q', '-v', 'ON_ERROR_STOP=1', '-d', db], { input: schema });
  const rows = run(pgBin('pg_dump'), ['--data-only', '--no-owner', '--no-privileges', '--table=schema_migrations', '--table=subscription_plans', schemaDb]);
  run(psql, ['-q', '-v', 'ON_ERROR_STOP=1', '-d', db], { input: rows });

  // ---- 2. seed (the admin persona is the first address in middleware/admin-auth.js, read as text)
  const adminSrc = fs.readFileSync(path.join(ROOT, 'middleware/admin-auth.js'), 'utf8');
  const adminEmail = ((adminSrc.match(/ADMIN_EMAILS\s*=\s*\[\s*['"]([^'"]+)['"]/) || [])[1] || '').toLowerCase();
  if (!adminEmail) throw new Error('could not read ADMIN_EMAILS[0] from middleware/admin-auth.js');
  run(psql, ['-q', '-v', 'ON_ERROR_STOP=1', '-v', `admin_email=${adminEmail}`, '-d', db, '-f', path.join(HARNESS, 'seed.sql')]);

  // ---- 3. fixtures
  const fixtures = path.join(work, 'fixtures');
  writeYahooFixtures(fixtures);

  // ---- 4. boot
  const port = await freePort();
  const token = 'harness-' + crypto.randomBytes(24).toString('hex');
  const webhookSecret = 'harness-' + crypto.randomBytes(16).toString('hex');
  const logFile = path.join(work, 'server.log');
  const routesOut = path.join(work, 'routes-runtime.json');
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, USER: user, TZ: 'UTC', LANG: 'en_GB.UTF-8',
    NODE_ENV: 'development', PORT: String(port), BASE_URL: `http://127.0.0.1:${port}`, DATABASE_URL: dbUrl,
    GOOGLE_CLIENT_ID: 'harness.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'harness-not-a-secret',
    CALLBACK_URL: `http://127.0.0.1:${port}/auth/google/callback`, SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    ANALYSIS_API_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    AUTO_EXECUTE: 'false', CONVICTION_SWEEP: 'false', CONVICTION_SWEEP_BOOT_RESUME: 'false', CONVICTION_SWEEP_ALERTS: 'false',
    CLOSE_FAILURE_ALERTS: 'false', EXIT_CHECK_PRUNE: 'false',
    HARNESS_LOGIN: '1', HARNESS_FIXTURES: fixtures, HARNESS_ROUTES_OUT: routesOut
  };
  const out = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, ['-r', path.join(HARNESS, 'preload.js'), 'server.js'], {
    cwd: ROOT, env, stdio: ['ignore', out, out], detached: false
  });
  ctx.child = child;
  let exited = null;
  child.on('exit', (code) => { exited = code; });

  const t0 = Date.now();
  for (;;) {
    const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    if (/refusing to start/.test(text) || exited !== null) {
      throw new Error(`harness server did not start (exit ${exited}):\n${text.slice(-3000)}`);
    }
    const listening = text.includes('[HARNESS] listening');
    const startupDone = /\[STARTUP\] (No old pending signals|Removed \d+ old pending|Error cleaning)/.test(text);
    if (listening && startupDone && (await get(`http://127.0.0.1:${port}/health`)) === 200) break;
    if (Date.now() - t0 > 90000) throw new Error(`harness server not ready after 90 s:\n${text.slice(-3000)}`);
    await sleep(300);
  }

  // ---- 5. facts the specs need (ids of seeded rows)
  const q = (sql) => run(psql, ['-At', '-d', db, '-c', sql]).trim();
  const facts = {
    userActiveTradeId: q("SELECT id FROM trades WHERE user_id = 'harness-user@e2e.invalid' AND status = 'active' ORDER BY id LIMIT 1"),
    userClosedTradeId: q("SELECT id FROM trades WHERE user_id = 'harness-user@e2e.invalid' AND status = 'closed' ORDER BY id LIMIT 1"),
    deleteTradeId: q("SELECT id FROM trades WHERE user_id = 'harness-delete@e2e.invalid' ORDER BY id LIMIT 1"),
    pendingSignalId: q("SELECT id FROM pending_signals WHERE symbol = 'HARNESSP.L' ORDER BY id LIMIT 1"),
    hcTradeId: q("SELECT id FROM high_conviction_portfolio WHERE symbol = 'HARNESSH.L' ORDER BY id LIMIT 1"),
    victimSubscriptionId: q("SELECT id FROM user_subscriptions WHERE user_email = 'harness-victim@e2e.invalid' ORDER BY id LIMIT 1"),
    paymentTxnId: 'harness-txn-0001',
    freePlanId: q("SELECT id FROM subscription_plans WHERE plan_code = 'FREE' ORDER BY id LIMIT 1")
  };

  const state = {
    base: `http://127.0.0.1:${port}`, port, pid: child.pid, db, work, logFile, routesOut, token, webhookSecret,
    personas: {
      user: 'harness-user@e2e.invalid', nosub: 'harness-nosub@e2e.invalid', delete: 'harness-delete@e2e.invalid',
      victim: 'harness-victim@e2e.invalid', trial: 'harness-trial@e2e.invalid', logout: 'harness-logout@e2e.invalid',
      admin: adminEmail
    },
    facts
  };
  const stateFile = path.join(work, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 1), { mode: 0o600 });
  process.env.HARNESS_STATE = stateFile;
  child.unref();
}

// jest skips globalTeardown when globalSetup throws: clean up here instead of leaking a server or database.
module.exports = async function globalSetup() {
  const ctx = {};
  try {
    await setup(ctx);
  } catch (error) {
    if (ctx.child && ctx.child.exitCode === null) ctx.child.kill('SIGKILL');
    if (process.env.HARNESS_KEEP !== '1') {
      if (ctx.db) spawnSync(pgBin('dropdb'), ['--if-exists', '--force', ctx.db], { encoding: 'utf8' });
      if (ctx.work) fs.rmSync(ctx.work, { recursive: true, force: true });
    }
    throw error;
  }
};
