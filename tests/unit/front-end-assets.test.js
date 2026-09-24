/**
 * Front-end files: every script under public/js is loaded by a page, and every local file a page
 * asks for exists with that exact spelling.
 *
 * Until 2026-09-24 public/js held 27 scripts that did nothing: 15 that no page loaded, 11 that pages
 * loaded although nothing called them, and the AI check modal, whose only opener went with the pre-v3
 * Scanner. A script no page loads still reads as live code; a tag for a file that is gone is a 404 on
 * every page view. Render's disk is case-sensitive and a Mac's is not, so "exists" means as spelled.
 *
 * A script loaded some other way (a dynamic loader) goes in LOADED_OTHERWISE, with the reason.
 * The lib/ files the pages load are checked by browser-lib.test.js.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '../../public');
const LOADED_OTHERWISE = [];

/** Every file under a folder of public/, as the URL path it is served at */
const filesUnder = dir => fs.readdirSync(path.join(PUBLIC, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : ['/' + path.join(dir, entry.name).split(path.sep).join('/')]);

/** True when public/<url> is a file with exactly this spelling */
function servedAsSpelled(url) {
    let at = PUBLIC;
    for (const part of url.replace(/^\//, '').split('/')) {
        if (!fs.existsSync(at) || !fs.statSync(at).isDirectory() || !fs.readdirSync(at).includes(part)) return false;
        at = path.join(at, part);
    }
    return fs.statSync(at).isFile();
}

/** Every local file a page loads: script src, and link href (stylesheets, the icon, the manifest) */
const pages = fs.readdirSync(PUBLIC).filter(name => name.endsWith('.html'));
const refs = pages.flatMap(page => {
    const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
    const urls = [
        ...[...html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["']/g)].map(m => m[1]),
        ...[...html.matchAll(/<link\b[^>]*\shref=["']([^"']+)["']/g)].map(m => m[1])
    ];
    return urls
        .filter(url => !/^(https?:)?\/\//.test(url))
        .map(url => ({ page, url: new URL(url, 'http://pages.test/' + page).pathname }))
        .filter(ref => !ref.url.startsWith('/lib/'));
});

test('every script under public/js is loaded by a page', () => {
    const loaded = new Set(refs.map(ref => ref.url));
    const scripts = filesUnder('js').filter(url => url.endsWith('.js'));
    // control: the scan sees the app shell on the app pages, and most scripts as loaded
    expect(refs.filter(ref => ref.url === '/js/app-shell.js').length).toBeGreaterThanOrEqual(5);
    expect(scripts.filter(url => loaded.has(url)).length).toBeGreaterThan(50);
    expect(scripts.filter(url => !loaded.has(url) && !LOADED_OTHERWISE.includes(url))).toEqual([]);
});

test('every local file a page asks for exists as spelled', () => {
    expect(refs.length).toBeGreaterThan(80); // control: the scan sees the pages' tags
    expect(refs.filter(ref => !servedAsSpelled(ref.url))).toEqual([]);
});
