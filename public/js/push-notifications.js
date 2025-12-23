/**
 * Push Notifications Client Library
 * Handles service worker registration and push subscription management
 */

const PushNotifications = {
    serviceWorkerRegistration: null,
    isSupported: false,

    /**
     * Initialize push notification support
     * @returns {Promise<boolean>} Whether push is supported
     */
    async init() {
        // Check browser support
        this.isSupported = 'serviceWorker' in navigator &&
                          'PushManager' in window &&
                          'Notification' in window;

        if (!this.isSupported) {
            console.warn('[PUSH] Push notifications not supported in this browser');
            return false;
        }

        console.log('[PUSH] Push notifications supported');
        return true;
    },

    /**
     * Register the service worker
     * @returns {Promise<ServiceWorkerRegistration|null>}
     */
    async registerServiceWorker() {
        if (!this.isSupported) {
            console.warn('[PUSH] Cannot register service worker - not supported');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('[PUSH] Service worker registered:', registration.scope);

            // Wait for the service worker to be ready
            await navigator.serviceWorker.ready;
            console.log('[PUSH] Service worker is ready');

            this.serviceWorkerRegistration = registration;
            return registration;
        } catch (error) {
            console.error('[PUSH] Service worker registration failed:', error);
            return null;
        }
    },

    /**
     * Request notification permission from user
     * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
     */
    async requestPermission() {
        if (!this.isSupported) {
            return 'denied';
        }

        try {
            const permission = await Notification.requestPermission();
            console.log('[PUSH] Permission status:', permission);
            return permission;
        } catch (error) {
            console.error('[PUSH] Error requesting permission:', error);
            return 'denied';
        }
    },

    /**
     * Get current notification permission status
     * @returns {string} Permission status
     */
    getPermissionStatus() {
        if (!this.isSupported) {
            return 'denied';
        }
        return Notification.permission;
    },

    /**
     * Get VAPID public key from server
     * @returns {Promise<string|null>}
     */
    async getVapidPublicKey() {
        try {
            const response = await fetch('/api/push/vapid-public-key');
            if (!response.ok) {
                throw new Error('Failed to fetch VAPID key');
            }
            const data = await response.json();
            return data.publicKey;
        } catch (error) {
            console.error('[PUSH] Error fetching VAPID key:', error);
            return null;
        }
    },

    /**
     * Convert base64 VAPID key to Uint8Array
     * @param {string} base64String - Base64 encoded VAPID key
     * @returns {Uint8Array}
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    /**
     * Subscribe to push notifications
     * @returns {Promise<{success: boolean, subscription?: PushSubscription, error?: string}>}
     */
    async subscribe() {
        if (!this.isSupported) {
            return { success: false, error: 'Push notifications not supported' };
        }

        // Ensure service worker is registered
        if (!this.serviceWorkerRegistration) {
            await this.registerServiceWorker();
        }

        if (!this.serviceWorkerRegistration) {
            return { success: false, error: 'Service worker not registered' };
        }

        // Request permission if needed
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
            return { success: false, error: 'Notification permission denied' };
        }

        try {
            // Get VAPID public key
            const vapidPublicKey = await this.getVapidPublicKey();
            if (!vapidPublicKey) {
                return { success: false, error: 'Could not get VAPID key from server' };
            }

            // Subscribe to push
            const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });

            console.log('[PUSH] Subscribed:', subscription);

            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    userAgent: navigator.userAgent
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save subscription');
            }

            const result = await response.json();
            console.log('[PUSH] Subscription saved to server:', result);

            return { success: true, subscription };
        } catch (error) {
            console.error('[PUSH] Subscription error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Unsubscribe from push notifications
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async unsubscribe() {
        if (!this.serviceWorkerRegistration) {
            return { success: false, error: 'No service worker registered' };
        }

        try {
            const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();

            if (!subscription) {
                console.log('[PUSH] No subscription to unsubscribe');
                return { success: true };
            }

            // Unsubscribe from push service
            const unsubscribed = await subscription.unsubscribe();
            if (!unsubscribed) {
                return { success: false, error: 'Failed to unsubscribe from push service' };
            }

            // Remove subscription from server
            const response = await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint
                })
            });

            if (!response.ok) {
                console.warn('[PUSH] Failed to remove subscription from server');
            }

            console.log('[PUSH] Unsubscribed successfully');
            return { success: true };
        } catch (error) {
            console.error('[PUSH] Unsubscribe error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Check if user is currently subscribed
     * @returns {Promise<boolean>}
     */
    async isSubscribed() {
        if (!this.serviceWorkerRegistration) {
            await this.registerServiceWorker();
        }

        if (!this.serviceWorkerRegistration) {
            return false;
        }

        try {
            const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
            return subscription !== null;
        } catch (error) {
            console.error('[PUSH] Error checking subscription:', error);
            return false;
        }
    },

    /**
     * Get subscription status from server
     * @returns {Promise<{subscribed: boolean, subscriptions: number}>}
     */
    async getServerStatus() {
        try {
            const response = await fetch('/api/push/status');
            if (!response.ok) {
                throw new Error('Failed to get status');
            }
            return await response.json();
        } catch (error) {
            console.error('[PUSH] Error getting server status:', error);
            return { subscribed: false, subscriptions: 0 };
        }
    },

    /**
     * Send a test notification (for debugging)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendTestNotification() {
        try {
            const response = await fetch('/api/push/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to send test notification');
            }

            return { success: true };
        } catch (error) {
            console.error('[PUSH] Test notification error:', error);
            return { success: false, error: error.message };
        }
    }
};

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', async () => {
    await PushNotifications.init();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PushNotifications;
}
