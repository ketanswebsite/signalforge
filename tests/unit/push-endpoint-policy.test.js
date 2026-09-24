/**
 * Web push endpoints (lib/push/endpoint-policy.js). Every send is a POST from this server to the subscription's
 * endpoint, and until 2026-09-24 any signed-in account could register any URL, as many as it liked.
 */
const { isAllowedPushEndpoint, prunePushSubscriptions, MAX_SUBSCRIPTIONS_PER_USER } = require('../../lib/push/endpoint-policy');

describe('isAllowedPushEndpoint', () => {
    test.each([
        'https://fcm.googleapis.com/fcm/send/abc:APA91b',
        'https://android.googleapis.com/gcm/send/abc',
        'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
        'https://web.push.apple.com/QH-abc',
        'https://api.push.apple.com/3/device/abc',
        'https://wns2-db5p.notify.windows.com/w/?token=abc',
        'https://FCM.GOOGLEAPIS.COM/fcm/send/abc'
    ])('a browser push service: %s', url => {
        expect(isAllowedPushEndpoint(url)).toBe(true);
    });

    test.each([
        ['http, not https', 'http://fcm.googleapis.com/fcm/send/abc'],
        ['another host', 'https://push.e2e.invalid/abc'],
        ['a look-alike host', 'https://fcm.googleapis.com.evil.example/abc'],
        ['a suffix without its dot', 'https://evilnotify.windows.com/abc'],
        ['the bare suffix', 'https://notify.windows.com/abc'],
        ['credentials in the URL', 'https://user:pass@fcm.googleapis.com/abc'],
        ['a port', 'https://fcm.googleapis.com:8443/abc'],
        ['localhost', 'https://localhost/abc'],
        ['a private address', 'https://10.0.0.1/abc'],
        ['not a URL', 'fcm.googleapis.com/abc'],
        ['not a string', { endpoint: 'https://fcm.googleapis.com/abc' }],
        ['too long', 'https://fcm.googleapis.com/' + 'a'.repeat(2100)]
    ])('refused: %s', (why, url) => {
        expect(isAllowedPushEndpoint(url)).toBe(false);
    });
});

describe('prunePushSubscriptions', () => {
    test('keeps the account\'s newest subscriptions and deletes the rest', async () => {
        const calls = [];
        const pool = { query: async (sql, params) => { calls.push([sql, params]); return { rowCount: 2 }; } };
        await expect(prunePushSubscriptions(pool, 'someone@e2e.invalid')).resolves.toBe(2);
        const [sql, params] = calls[0];
        expect(params).toEqual(['someone@e2e.invalid', MAX_SUBSCRIPTIONS_PER_USER]);
        expect(sql).toMatch(/DELETE FROM push_subscriptions\s+WHERE user_email = \$1 AND id NOT IN/);
        expect(sql).toMatch(/ORDER BY COALESCE\(last_used_at, created_at\) DESC, id DESC\s+LIMIT \$2/);
    });

    test('the cap is ten', () => {
        expect(MAX_SUBSCRIPTIONS_PER_USER).toBe(10);
    });
});

describe('PushService.sendNotification', () => {
    test('never POSTs to a stored endpoint that is not a push service, and switches it off', async () => {
        const webPush = require('web-push');
        const vapid = webPush.generateVAPIDKeys();
        const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
        process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
        process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const send = jest.spyOn(webPush, 'sendNotification').mockResolvedValue({ statusCode: 201 });
        const deactivated = [];
        try {
            const PushService = require('../../lib/push/push-service');
            const service = new PushService({ deactivatePushSubscription: async endpoint => deactivated.push(endpoint), updatePushSubscriptionLastUsed: async () => {} });
            expect(await service.sendNotification({ endpoint: 'https://push.e2e.invalid/legacy', keys_p256dh: 'p', keys_auth: 'a' }, { title: 't' })).toBe(false);
            expect(send).not.toHaveBeenCalled();
            expect(deactivated).toEqual(['https://push.e2e.invalid/legacy']);
            expect(await service.sendNotification({ endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys_p256dh: 'p', keys_auth: 'a' }, { title: 't' })).toBe(true);
            expect(send).toHaveBeenCalledTimes(1);
        } finally {
            process.env.VAPID_PUBLIC_KEY = saved.pub;
            process.env.VAPID_PRIVATE_KEY = saved.priv;
            if (saved.pub === undefined) delete process.env.VAPID_PUBLIC_KEY;
            if (saved.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
        }
    });
});
