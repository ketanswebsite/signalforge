/**
 * Web push and the installable app point at things that exist, and one bad endpoint cannot stall a broadcast.
 *
 * Until I8 every notification opened /account, a page that never existed (a 404); every notification and the
 * manifest used /images/favicon.PNG, the retired 418 KB logo (489x489 px, declared as 192x192 and 512x512);
 * no page linked the manifest; and a send had no timeout. The service worker runs here in a bare VM context,
 * with stand-ins for the few browser objects it touches.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '../..');
const PUBLIC = path.join(ROOT, 'public');
const read = rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
const APP_PAGES = ['index.html', 'trades.html', 'portfolio-backtest.html', 'telegram-subscribe.html', 'account.html'];

/** True when public/<url> is a file with exactly this spelling: Render's disk is case-sensitive, a Mac's is not. */
function servedAsSpelled(url) {
    let at = PUBLIC;
    for (const part of url.replace(/^\//, '').split('/')) {
        if (!fs.existsSync(at) || !fs.statSync(at).isDirectory() || !fs.readdirSync(at).includes(part)) return false;
        at = path.join(at, part);
    }
    return fs.statSync(at).isFile();
}

/** "WIDTHxHEIGHT" from a PNG's IHDR chunk */
function pngSize(url) {
    const png = fs.readFileSync(path.join(PUBLIC, url));
    return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

/** Every .js file under a folder of the repo */
const jsUnder = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? jsUnder(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);

describe('web app manifest', () => {
    const manifest = JSON.parse(read('manifest.json'));

    test('every icon exists at the size it declares', () => {
        expect(manifest.icons.length).toBeGreaterThan(0);
        for (const icon of manifest.icons) {
            expect(servedAsSpelled(icon.src)).toBe(true);
            expect(pngSize(icon.src)).toBe(icon.sizes);
        }
    });

    test('it starts on a page that exists', () => {
        expect(servedAsSpelled(manifest.start_url)).toBe(true);
    });

    test('the five app pages link it, and declare its theme colour', () => {
        for (const page of APP_PAGES) {
            const html = read(page);
            expect(html).toContain('<link rel="manifest" href="/manifest.json">');
            expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}">`);
        }
    });
});

describe('push service worker', () => {
    /** public/service-worker.js with stand-ins for the browser objects it uses; openWindows = tabs already open */
    function loadWorker(openWindows = []) {
        const listeners = {};
        const shown = [];
        const opened = [];
        const self = {
            location: { origin: 'https://app.test' },
            registration: { showNotification: (title, options) => { shown.push({ title, options }); return Promise.resolve(); } },
            clients: { claim: () => Promise.resolve() },
            skipWaiting: () => {},
            addEventListener: (type, handler) => { listeners[type] = handler; }
        };
        const clients = {
            matchAll: () => Promise.resolve(openWindows),
            openWindow: url => { opened.push(url); return Promise.resolve(); }
        };
        const quiet = { log: () => {}, error: () => {} };
        vm.runInNewContext(read('service-worker.js'), { self, clients, caches: { keys: () => Promise.resolve([]) }, console: quiet });
        const dispatch = async (type, event) => {
            let pending;
            listeners[type]({ ...event, waitUntil: promise => { pending = promise; } });
            await pending;
        };
        return { dispatch, shown, opened };
    }

    const notification = data => ({ data, close: () => {} });

    test('a push without a payload shows the app icon and links to the Account page', async () => {
        const worker = loadWorker();
        await worker.dispatch('push', { data: null });
        const { options } = worker.shown[0];
        expect(options.icon).toBe('/images/brand/app-icon.png');
        expect(options.badge).toBe(options.icon);
        expect(servedAsSpelled(options.icon)).toBe(true);
        expect(options.data.url).toBe('/account.html');
    });

    test('a click on a notification that carries no link opens the Account page', async () => {
        const worker = loadWorker();
        await worker.dispatch('notificationclick', { notification: notification({}) });
        expect(worker.opened).toEqual(['/account.html']);
    });

    test('a click follows the link the notification carries', async () => {
        const worker = loadWorker();
        await worker.dispatch('notificationclick', { notification: notification({ url: '/trades.html' }) });
        expect(worker.opened).toEqual(['/trades.html']);
    });

    test('with the app already open, the click takes that tab to the Account page', async () => {
        const navigated = [];
        const tab = { url: 'https://app.test/index.html', focus: () => Promise.resolve(), navigate: url => { navigated.push(url); return Promise.resolve(); } };
        const worker = loadWorker([tab]);
        await worker.dispatch('notificationclick', { notification: notification({}) });
        expect(navigated).toEqual(['/account.html']);
        expect(worker.opened).toEqual([]);
    });
});

describe('notifications the server sends', () => {
    const sources = ['server.js', ...jsUnder('lib')].map(rel => ({ rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') }));
    const found = pattern => sources.flatMap(({ rel, text }) => [...text.matchAll(pattern)].map(m => ({ rel, url: m[1] })));

    test('every icon and badge is an image that exists as spelled', () => {
        const refs = found(/(?:icon|badge):\s*['"`](\/images\/[^'"`]+)['"`]/g);
        expect(refs.length).toBeGreaterThanOrEqual(5); // control: the scan sees the senders
        expect(refs.filter(ref => !servedAsSpelled(ref.url))).toEqual([]);
    });

    test('every link is a page that exists', () => {
        const refs = found(/url:\s*(?:[\w.]+\s*\|\|\s*)?['"`](\/[^'"`]*)['"`]/g);
        expect(refs.length).toBeGreaterThanOrEqual(3); // control: the scan sees the senders
        expect(refs.filter(ref => !servedAsSpelled(ref.url))).toEqual([]);
    });

    test('every send has a timeout, so an endpoint that never answers cannot stall a broadcast', async () => {
        const webPush = require('web-push');
        const vapid = webPush.generateVAPIDKeys();
        const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
        process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
        process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const send = jest.spyOn(webPush, 'sendNotification').mockResolvedValue({ statusCode: 201 });
        try {
            const PushService = require('../../lib/push/push-service');
            const service = new PushService(null);
            expect(service.isConfigured).toBe(true);
            expect(await service.sendNotification({ endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys_p256dh: 'p', keys_auth: 'a' }, { title: 't' })).toBe(true);
            const options = send.mock.calls[0][2] || {};
            expect(options.timeout).toBeGreaterThan(0);
            expect(options.timeout).toBeLessThanOrEqual(30000);
        } finally {
            process.env.VAPID_PUBLIC_KEY = saved.pub;
            process.env.VAPID_PRIVATE_KEY = saved.priv;
            if (saved.pub === undefined) delete process.env.VAPID_PUBLIC_KEY;
            if (saved.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
        }
    });
});
