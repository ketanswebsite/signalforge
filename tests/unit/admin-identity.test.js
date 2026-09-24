/**
 * @jest-environment node
 *
 * The admin identity (config/admin.js). Who the admin is comes from ADMIN_EMAIL, through one module, and
 * "admin" has one definition. Until 2026-09-24 the owner's address was spelled out in 17 places in the
 * server and 26 in the database module, and three rules decided who was admin: the /api/admin guard used
 * a hard-coded list and ignored ADMIN_EMAIL, the admin pages and the high-conviction routes a hard-coded
 * constant, and everything else ADMIN_EMAIL with the address as its fallback.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const MODULE = 'config/admin.js';
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
// The fallback address, read out of the module: this file must not spell it either
const FALLBACK = (read(MODULE).match(/^const FALLBACK_ADMIN_EMAIL = '([^']+)';$/m) || [])[1];

const Admin = require('../../config/admin');
const AdminAuth = require('../../middleware/admin-auth');

// Every file the server runs, serves or is tested with, and the docs. Not node_modules or dot-files (a
// local .env may well hold the address), and not migrations/: those SQL files ran once, by hand, against
// the owner's account, and stay as the record of what ran (HISTORICAL pins them, so a new one cannot).
const SCANNED = ['server.js', 'database-postgres.js', 'package.json', 'render.yaml', 'README.md', 'CLAUDE.md',
    '.env.example', 'config', 'routes', 'middleware', 'lib', 'ml', 'public', 'scripts', 'tests', 'docs'];
const HISTORICAL = ['010_migrate_trades_to_primary_user.sql', '013_sync_active_positions.sql',
    '014_backfill_allocated_capital.sql', '015_populate_investment_amount.sql', '016_recalculate_allocated_capital.sql',
    '017_backfill_shares.sql', '018_backfill_historical_realized_pl.sql', '020_migrate_system_capital_to_user.sql'];
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|pdf)$/i;
// The code the server runs (tests set ADMIN_EMAIL themselves, so they are not in this list)
const RUNTIME = ['server.js', 'database-postgres.js', 'config', 'routes', 'middleware', 'lib', 'ml'];

function files(rel) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return BINARY.test(rel) ? [] : [rel];
    return fs.readdirSync(abs).filter(name => !name.startsWith('.') && name !== 'node_modules')
        .flatMap(name => files(path.posix.join(rel, name)));
}
const holdsAddress = rel => read(rel).toLowerCase().includes(FALLBACK);

const savedAdminEmail = process.env.ADMIN_EMAIL;
afterEach(() => {
    if (savedAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = savedAdminEmail;
});

describe('the address lives in config/admin.js only', () => {
    const scanned = SCANNED.flatMap(files);

    test('control: the module holds it, and the scan reads the server, the pages and the tests', () => {
        expect(FALLBACK).toMatch(/^[^@\s]+@[^@\s]+$/);
        expect(holdsAddress(MODULE)).toBe(true);
        expect(scanned).toEqual(expect.arrayContaining([MODULE, 'server.js', 'database-postgres.js',
            'lib/scheduler/trade-executor.js', 'public/admin-v2.html', 'tests/endpoints/harness/seed.sql']));
        expect(scanned.length).toBeGreaterThan(200);
    });

    test('no other file spells it: the server, the database module, the pages, the scripts, the tests, the docs', () => {
        expect(scanned.filter(rel => rel !== MODULE && holdsAddress(rel))).toEqual([]);
    });

    test('migrations/: only the one-time data fixes that already ran against the owner\'s account', () => {
        const holding = files('migrations').filter(holdsAddress).map(rel => path.basename(rel));
        expect(holding.filter(name => !HISTORICAL.includes(name))).toEqual([]);
    });

    test('the server reads ADMIN_EMAIL through the module, and the old hard-coded list is gone', () => {
        // code only: a comment line may name the variable
        const code = rel => read(rel).replace(/^\s*(\/\/|\/\*|\*).*$/gm, '');
        const runtime = RUNTIME.flatMap(files).filter(rel => rel.endsWith('.js') && rel !== MODULE);
        expect(runtime.length).toBeGreaterThan(40);
        expect(runtime.filter(rel => /process\.env\.ADMIN_EMAILS?\b/.test(code(rel)))).toEqual([]);
        expect(runtime.filter(rel => /\bADMIN_EMAILS\b/.test(code(rel)))).toEqual([]);
    });
});

describe('adminEmail(), adminEmailConfigured(), isAdmin()', () => {
    test('ADMIN_EMAIL unset (or blank): the fallback, and configured says so', () => {
        delete process.env.ADMIN_EMAIL;
        expect(Admin.adminEmail()).toBe(FALLBACK);
        expect(Admin.adminEmailConfigured()).toBe(false);
        process.env.ADMIN_EMAIL = '   ';
        expect(Admin.adminEmail()).toBe(FALLBACK);
        expect(Admin.adminEmailConfigured()).toBe(false);
    });

    test('ADMIN_EMAIL set: that account, trimmed and lower case (sign-in stores emails lower case), read on every call', () => {
        process.env.ADMIN_EMAIL = ' Owner@E2E.invalid ';
        expect(Admin.adminEmail()).toBe('owner@e2e.invalid');
        expect(Admin.adminEmailConfigured()).toBe(true);
        process.env.ADMIN_EMAIL = 'other@e2e.invalid';
        expect(Admin.adminEmail()).toBe('other@e2e.invalid');
    });

    test('isAdmin: the admin\'s account in any case or spacing, nobody else, and nothing for no account', () => {
        process.env.ADMIN_EMAIL = 'owner@e2e.invalid';
        expect(Admin.isAdmin('owner@e2e.invalid')).toBe(true);
        expect(Admin.isAdmin(' OWNER@e2e.invalid ')).toBe(true);
        expect(Admin.isAdmin('someone@e2e.invalid')).toBe(false);
        for (const nobody of [undefined, null, '', '   ', 42, {}]) expect(Admin.isAdmin(nobody)).toBe(false);
    });

    test('adminEmailMatchesFallback: only when ADMIN_EMAIL names the fallback account, in any case or spacing', () => {
        delete process.env.ADMIN_EMAIL;
        expect(Admin.adminEmailMatchesFallback()).toBe(false);
        process.env.ADMIN_EMAIL = ` ${FALLBACK.toUpperCase()} `;
        expect(Admin.adminEmailMatchesFallback()).toBe(true);
        expect(Admin.adminEmail()).toBe(FALLBACK);
        process.env.ADMIN_EMAIL = 'owner@e2e.invalid';
        expect(Admin.adminEmailMatchesFallback()).toBe(false);
    });

    test('one admin: with ADMIN_EMAIL set, the fallback address is an ordinary account', () => {
        process.env.ADMIN_EMAIL = 'owner@e2e.invalid';
        expect(Admin.isAdmin(FALLBACK)).toBe(false);
        delete process.env.ADMIN_EMAIL;
        expect(Admin.isAdmin(FALLBACK)).toBe(true);
        expect(Admin.isAdmin('owner@e2e.invalid')).toBe(false);
    });
});

describe('one definition of admin', () => {
    // ensureAdminAPI with a fake request: 'next' when it lets the request through, else the status it answered
    const guard = (email) => {
        let status = null;
        let passed = false;
        const req = email ? { user: { email } } : {};
        const res = { status(s) { status = s; return this; }, json() { return this; } };
        AdminAuth.ensureAdminAPI(req, res, () => { passed = true; });
        return passed ? { passed, adminUser: req.adminUser } : { passed, status };
    };

    test('middleware/admin-auth.js hands out the module\'s own isAdmin, and no list of its own', () => {
        expect(AdminAuth.isAdmin).toBe(Admin.isAdmin);
        expect(AdminAuth.ADMIN_EMAILS).toBeUndefined();
    });

    test('the /api/admin guard follows ADMIN_EMAIL (it used a hard-coded list and ignored it)', () => {
        delete process.env.ADMIN_DEV_BYPASS;
        process.env.ADMIN_EMAIL = 'owner@e2e.invalid';
        expect(guard('owner@e2e.invalid')).toMatchObject({ passed: true, adminUser: { email: 'owner@e2e.invalid', role: 'super_admin' } });
        expect(guard(FALLBACK)).toEqual({ passed: false, status: 403 });
        expect(guard('someone@e2e.invalid')).toEqual({ passed: false, status: 403 });
        expect(guard(undefined)).toEqual({ passed: false, status: 403 });
    });

    test('determineAdminRole: the admin is the super admin, anyone else read-only', () => {
        process.env.ADMIN_EMAIL = 'owner@e2e.invalid';
        expect(AdminAuth.determineAdminRole('owner@e2e.invalid')).toBe(AdminAuth.ADMIN_ROLES.SUPER_ADMIN);
        expect(AdminAuth.determineAdminRole(FALLBACK)).toBe(AdminAuth.ADMIN_ROLES.READ_ONLY);
    });

    test('server.js: no admin constant of its own; every admin check asks the module', () => {
        const server = read('server.js');
        expect(server).not.toMatch(/^\s*const ADMIN_EMAIL\b/m);
        expect(server).not.toMatch(/[!=]==\s*\(?\s*(process\.env\.)?ADMIN_EMAIL\b/);
        expect((server.match(/AdminIdentity\.isAdmin\(/g) || []).length).toBeGreaterThanOrEqual(15);
    });
});
