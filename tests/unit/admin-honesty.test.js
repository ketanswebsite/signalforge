/**
 * @jest-environment node
 *
 * The admin portal shows only what the server did or holds. Until 2026-09-24 it had buttons that
 * answered "coming soon" or reported success for work nothing did, charts of random or made-up
 * numbers where the real ones were missing, and hard-coded trends. These tripwires keep them out; the
 * endpoint harness checks the answers themselves (tests/endpoints/routes.test.js).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const adminScripts = fs.readdirSync(path.join(ROOT, 'public/js'))
    .filter(name => /^admin-.*\.js$/.test(name))
    .map(name => `public/js/${name}`);

test('control: the admin page and its scripts are found', () => {
    expect(adminScripts).toEqual(expect.arrayContaining(['public/js/admin-dashboard.js', 'public/js/admin-settings.js']));
    expect(read('public/admin-v2.html')).toContain('/js/admin-settings.js');
});

test.each(adminScripts)('%s offers nothing "coming soon" and plots no random numbers', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/coming soon/i);
    expect(src).not.toMatch(/Math\.random\(\)\s*\*/);
});

test('the admin page shows no hard-coded change under a figure', () => {
    expect(read('public/admin-v2.html')).not.toMatch(/[+-]0%/);
});

test('the admin router has no placeholder handler and no hard-coded trend', () => {
    const src = read('routes/admin.js');
    expect(src).not.toMatch(/\/\/ Placeholder/);
    expect(src).not.toMatch(/['"][+-]\d+%['"]/);
});
