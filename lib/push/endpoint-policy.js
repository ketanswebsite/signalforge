/**
 * Which URLs this server will POST web-push messages to.
 *
 * A browser's push subscription names its push service's endpoint, and every send is an HTTPS POST from this
 * server to that URL. Until 2026-09-24 any signed-in account could register any URL, as many as it liked, so any
 * account could make the server POST to any address on every broadcast. Only the browsers' own push services are
 * accepted now, and an account keeps its newest MAX_SUBSCRIPTIONS_PER_USER subscriptions (a browser per device).
 */

// Chrome, Edge on Android, Opera, Samsung Internet and Brave use Google's service; Firefox, Mozilla's; Safari,
// Apple's; Edge on Windows, Microsoft's (WNS). Exact hosts, plus the subdomains of the last three.
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_HOST_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];
const MAX_SUBSCRIPTIONS_PER_USER = 10;

/** True only for an https URL on a browser push service, on the default port, with no credentials in it. */
function isAllowedPushEndpoint(endpoint) {
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
    let url;
    try {
        url = new URL(endpoint);
    } catch (error) {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
}

/** Keep an account's newest subscriptions and delete the rest. Resolves to how many went. */
async function prunePushSubscriptions(pool, userEmail, keep = MAX_SUBSCRIPTIONS_PER_USER) {
    const { rowCount } = await pool.query(`
        DELETE FROM push_subscriptions
        WHERE user_email = $1 AND id NOT IN (
            SELECT id FROM push_subscriptions
            WHERE user_email = $1
            ORDER BY COALESCE(last_used_at, created_at) DESC, id DESC
            LIMIT $2
        )
    `, [userEmail, keep]);
    return rowCount;
}

module.exports = { isAllowedPushEndpoint, prunePushSubscriptions, MAX_SUBSCRIPTIONS_PER_USER, PUSH_HOSTS, PUSH_HOST_SUFFIXES };
