/**
 * Telegram's legacy Markdown (parse_mode 'Markdown'), for text a message did not write itself: a name, an email
 * address, a link parameter, a bot name, a database error. In legacy Markdown _ * ` [ open an entity, and Telegram
 * REJECTS a message whose markup does not balance (400 "can't parse entities"): "chk_trades_date_logic" or
 * "jane_doe@example.com" alone does it. Escaped, outside any entity, such text arrives verbatim.
 *
 * Shared by the bot's own replies (lib/telegram/telegram-bot.js) and the owner alerts
 * (lib/portfolio/close-failure-alerts.js, which re-exports markdownSafe for its callers).
 */
'use strict';

/** Text made safe to put into a legacy-Markdown message. A backslash cannot be escaped there, so it becomes '/'. */
function markdownSafe(text) {
    return String(text === undefined || text === null ? '' : text)
        .replace(/\\/g, '/')
        .replace(/([_*`\[])/g, '\\$1');
}

/** The same message with no markup at all: the second attempt when Telegram turns the formatted one down. */
function plainText(message) {
    return String(message).replace(/\\([_*`\[])/g, '$1').replace(/[*`]/g, '');
}

module.exports = { markdownSafe, plainText };
