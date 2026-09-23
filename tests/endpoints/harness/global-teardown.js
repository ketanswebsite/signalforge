/**
 * Endpoint harness - jest globalTeardown: stop the harness server, drop its scratch database and delete its
 * work dir. It only stops the harness's own server process: the stop is by the PID recorded in global-setup,
 * and only if that process is still running server.js under the harness preload.
 * Set HARNESS_KEEP=1 to keep the database and the log for debugging.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
function pgBin(name) {
  for (const dir of [process.env.PG_BIN, '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', '/usr/bin']) {
    if (dir && fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  }
  return name;
}

module.exports = async function globalTeardown() {
  const file = process.env.HARNESS_STATE;
  if (!file || !fs.existsSync(file)) return;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));

  const cmd = spawnSync('ps', ['-o', 'command=', '-p', String(state.pid)], { encoding: 'utf8' }).stdout || '';
  if (alive(state.pid) && cmd.includes('preload.js') && cmd.includes('server.js')) {
    process.kill(state.pid, 'SIGTERM');
    for (let i = 0; i < 25 && alive(state.pid); i++) await sleep(200);
    if (alive(state.pid)) process.kill(state.pid, 'SIGKILL');
  }

  if (process.env.HARNESS_KEEP === '1') {
    console.log(`\n[harness] kept: db ${state.db}, log ${state.logFile}`);
    return;
  }
  if (/^sf_harness_[a-z0-9_]+$/.test(state.db)) {
    spawnSync(pgBin('dropdb'), ['--if-exists', '--force', state.db], { encoding: 'utf8' });
  }
  if (state.work && path.basename(state.work).startsWith('sf-harness-')) fs.rmSync(state.work, { recursive: true, force: true });
};
