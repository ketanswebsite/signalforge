/**
 * Web Push Notification Service
 * Handles sending push notifications to subscribed users
 */

const webPush = require('web-push');

class PushService {
    constructor(db) {
        this.db = db;
        this.isConfigured = false;
        this.configure();
    }

    /**
     * Configure web-push with VAPID keys
     */
    configure() {
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn('[PUSH] VAPID keys not configured - push notifications disabled');
            console.warn('[PUSH] Generate keys with: npx web-push generate-vapid-keys');
            return;
        }

        try {
            webPush.setVapidDetails(
                'mailto:alerts@sutralgo.com',
                vapidPublicKey,
                vapidPrivateKey
            );
            this.isConfigured = true;
            console.log('[PUSH] Web Push configured successfully');
        } catch (error) {
            console.error('[PUSH] Failed to configure web-push:', error.message);
        }
    }

    /**
     * Get VAPID public key for client
     * @returns {string|null}
     */
    getPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || null;
    }

    /**
     * Send push notification to a specific subscription
     * @param {Object} subscription - Push subscription object
     * @param {Object} payload - Notification payload
     * @returns {Promise<boolean>}
     */
    async sendNotification(subscription, payload) {
        if (!this.isConfigured) {
            console.warn('[PUSH] Cannot send notification - not configured');
            return false;
        }

        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys_p256dh || subscription.keys?.p256dh,
                auth: subscription.keys_auth || subscription.keys?.auth
            }
        };

        try {
            // Push services answer in well under a second. Without a timeout, one endpoint that never
            // answers (any signed-in account can register any URL) stalls every later subscriber, and the
            // 7 AM scan and the EOD summary stay "already running" until the next restart.
            await webPush.sendNotification(
                pushSubscription,
                JSON.stringify(payload),
                { timeout: 10000 }
            );

            // Update last_used_at
            if (this.db && typeof this.db.updatePushSubscriptionLastUsed === 'function') {
                await this.db.updatePushSubscriptionLastUsed(subscription.endpoint);
            }

            return true;
        } catch (error) {
            console.error('[PUSH] Failed to send notification:', error.message);

            // Handle expired/invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log('[PUSH] Subscription expired, marking inactive:', subscription.endpoint);
                if (this.db && typeof this.db.deactivatePushSubscription === 'function') {
                    await this.db.deactivatePushSubscription(subscription.endpoint);
                }
            }

            return false;
        }
    }

    /**
     * Send notification to a specific user (all their subscriptions)
     * @param {string} userEmail - User email
     * @param {Object} payload - Notification payload
     * @returns {Promise<{sent: number, failed: number}>}
     */
    async sendToUser(userEmail, payload) {
        if (!this.isConfigured || !this.db) {
            return { sent: 0, failed: 0 };
        }

        try {
            const subscriptions = await this.db.getPushSubscriptionsByUser(userEmail);

            if (!subscriptions || subscriptions.length === 0) {
                console.log(`[PUSH] No subscriptions found for user ${userEmail}`);
                return { sent: 0, failed: 0 };
            }

            let sent = 0;
            let failed = 0;

            for (const sub of subscriptions) {
                const success = await this.sendNotification(sub, payload);
                if (success) {
                    sent++;
                } else {
                    failed++;
                }
            }

            console.log(`[PUSH] Sent to user ${userEmail}: ${sent} success, ${failed} failed`);
            return { sent, failed };
        } catch (error) {
            console.error(`[PUSH] Error sending to user ${userEmail}:`, error.message);
            return { sent: 0, failed: 0 };
        }
    }

    /**
     * Broadcast notification to all active subscriptions
     * @param {Object} payload - Notification payload
     * @returns {Promise<{sent: number, failed: number}>}
     */
    async broadcast(payload) {
        if (!this.isConfigured || !this.db) {
            return { sent: 0, failed: 0 };
        }

        try {
            const subscriptions = await this.db.getAllActivePushSubscriptions();

            if (!subscriptions || subscriptions.length === 0) {
                console.log('[PUSH] No active subscriptions for broadcast');
                return { sent: 0, failed: 0 };
            }

            let sent = 0;
            let failed = 0;

            for (const sub of subscriptions) {
                const success = await this.sendNotification(sub, payload);
                if (success) {
                    sent++;
                } else {
                    failed++;
                }
            }

            console.log(`[PUSH] Broadcast complete: ${sent} sent, ${failed} failed`);
            return { sent, failed };
        } catch (error) {
            console.error('[PUSH] Broadcast error:', error.message);
            return { sent: 0, failed: 0 };
        }
    }

    /**
     * Send test notification
     * @param {string} userEmail - User email
     * @returns {Promise<Object>}
     */
    async sendTestNotification(userEmail) {
        const payload = {
            title: 'SutrAlgo Test Notification',
            body: 'Push notifications are working correctly!',
            icon: '/images/brand/app-icon.png',
            badge: '/images/brand/app-icon.png',
            tag: 'test-notification',
            url: '/account.html',
            requireInteraction: false
        };

        return await this.sendToUser(userEmail, payload);
    }
}

module.exports = PushService;
