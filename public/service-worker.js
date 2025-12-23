/**
 * Service Worker for SutrAlgo Push Notifications
 * Handles push events and notification clicks
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `sutralgo-${CACHE_VERSION}`;

// Handle push events from the server
self.addEventListener('push', function(event) {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'SutrAlgo Alert',
        body: 'New notification',
        icon: '/images/favicon.PNG',
        badge: '/images/favicon.PNG',
        tag: 'default',
        url: '/account',
        requireInteraction: false
    };

    // Parse push data if available
    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                tag: payload.tag || data.tag,
                url: payload.url || data.url,
                requireInteraction: payload.requireInteraction || data.requireInteraction,
                actions: payload.actions || [],
                data: payload.data || {}
            };
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: {
            url: data.url,
            ...data.data
        },
        requireInteraction: data.requireInteraction,
        vibrate: [200, 100, 200],
        actions: data.actions
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/account';

    // Handle action button clicks
    if (event.action) {
        console.log('[SW] Action clicked:', event.action);
        // Custom action handling can be added here
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                // Check if there's already an open window
                for (let client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// Service worker installation
self.addEventListener('install', function(event) {
    console.log('[SW] Installing service worker...');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        Promise.all([
            // Claim all clients immediately
            self.clients.claim(),
            // Clean up old caches if any
            caches.keys().then(function(cacheNames) {
                return Promise.all(
                    cacheNames.filter(function(cacheName) {
                        return cacheName.startsWith('sutralgo-') && cacheName !== CACHE_NAME;
                    }).map(function(cacheName) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
        ])
    );
});

// Handle messages from the main thread
self.addEventListener('message', function(event) {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
