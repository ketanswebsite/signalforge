/**
 * Who the admin is: one account, named by the ADMIN_EMAIL environment variable, and one definition of
 * "admin" for the whole server, isAdmin() below. The /api/admin guard (middleware/admin-auth.js), the
 * admin pages, the isAdmin that GET /api/user and GET /api/user/subscription report, the subscription
 * bypass and the high-conviction admin routes all ask it. adminEmail() is also the house book: the
 * account the 1 PM executor books every signal to, the owner the alerts go to, and the one account no
 * route deletes.
 *
 * ADMIN_EMAIL is read on every call, never cached, so the environment decides. Until production
 * confirms it is set (GET /api/ops/version reports adminEmailConfigured), the owner's account is the
 * fallback; adminEmailMatchesFallback says whether ADMIN_EMAIL names that same account, in which case
 * deleting the fallback moves nothing. This file is the only place in the repository that spells that address
 * (tests/unit/admin-identity.test.js); the browser learns whether the signed-in account is the admin
 * from GET /api/user (isAdmin), never the address.
 */
'use strict';

const FALLBACK_ADMIN_EMAIL = 'ketanjoshisahs@gmail.com';

/** Emails are stored lower case (config/auth.js lower-cases the Google address), so compare them that way. */
function normalise(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Whether ADMIN_EMAIL is set on this server. Never the address itself. */
function adminEmailConfigured() {
    return normalise(process.env.ADMIN_EMAIL) !== '';
}

/** Whether ADMIN_EMAIL is set and names the fallback account (so the fallback can go). Never the address. */
function adminEmailMatchesFallback() {
    return normalise(process.env.ADMIN_EMAIL) === FALLBACK_ADMIN_EMAIL;
}

/** The admin's account: ADMIN_EMAIL (trimmed, lower case), or the fallback while it is not set. */
function adminEmail() {
    return normalise(process.env.ADMIN_EMAIL) || FALLBACK_ADMIN_EMAIL;
}

/** Is this the admin's account? The one definition of "admin". */
function isAdmin(email) {
    const address = normalise(email);
    return address !== '' && address === adminEmail();
}

module.exports = { adminEmail, adminEmailConfigured, adminEmailMatchesFallback, isAdmin };
