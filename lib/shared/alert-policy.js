/**
 * Alert policy — does this subscriber want this personal Telegram message?
 *
 * The Alerts page stores one row of switches per user in alert_preferences. Until
 * this module no sender read that table, so every switch on the page was
 * decorative. This is the one place that turns a row of switches into "send" or
 * "don't send".
 *
 * It covers PERSONAL messages only - the DMs about a subscriber's own portfolio:
 * an exit (exit-monitor.js), the 1 PM bookings (trade-executor.js) and the evening
 * summary (eod-summary.js). It must never be consulted for the public broadcast:
 * that goes to telegram_subscribers, is not tied to an account, and is muted with
 * /stop in the bot.
 *
 * Pure: no I/O. Callers load the row with TradeDB.getAlertPreferences(email), which
 * returns null both for "never saved a row" and for a failed read.
 *
 * The bias is deliberate. A message sent to someone who already receives them costs
 * nothing; a stop-loss DM silently withheld from a paying subscriber is a failure
 * they cannot even report, because they never saw it. So everything ambiguous - no
 * row, a failed read, an event this table has never heard of, a NULL column -
 * resolves to SEND. Only an explicit `false` withholds.
 */

// The master switch ("Your own alerts" on the page). Off pauses every personal DM.
const MASTER_SWITCH = 'telegram_enabled';

// Which switch governs which event. The exit types are exit-monitor.js's own
// vocabulary; 'buy' is the 1 PM booking DM. `trailing_stop` arrives with the
// trailing-stop work - it is a stop, so it answers to the stop switch.
//
// An event that is ABSENT here has no switch of its own and answers to the master
// switch alone. That is how 'eod' works on purpose, and how a future exit type
// behaves until someone maps it: it sends.
const SWITCH_FOR_EVENT = {
  buy: 'alert_on_buy',
  target_reached: 'alert_on_target',
  stop_loss: 'alert_on_stoploss',
  trailing_stop: 'alert_on_stoploss',
  max_days: 'alert_on_time_exit',
  square_off: 'alert_on_time_exit'
};

/**
 * Should this subscriber get a personal DM about this event?
 *
 * @param {object|null} prefs  their alert_preferences row, or null when there is none
 *                             (never opened the Alerts page, or the read failed)
 * @param {string} event       a key of SWITCH_FOR_EVENT, 'eod', or anything else
 * @returns {boolean}          true = send
 */
function shouldSendOwnerAlert(prefs, event) {
  if (!prefs) return true;
  if (prefs[MASTER_SWITCH] === false) return false;
  const eventSwitch = SWITCH_FOR_EVENT[event];
  return !eventSwitch || prefs[eventSwitch] !== false;
}

/**
 * What the senders call: load the row, then decide. The read is injected so this
 * module still touches no database, and wrapped so that the fail-open promise is
 * kept HERE rather than resting on the loader happening to swallow its own errors.
 *
 * @param {() => Promise<object|null>} loadPrefs  e.g. () => TradeDB.getAlertPreferences(email)
 * @param {string} event
 * @returns {Promise<boolean>}  true = send
 */
async function ownerWantsAlert(loadPrefs, event) {
  let prefs = null;
  try {
    prefs = await loadPrefs();
  } catch (error) {
    console.error(`⚠️ [ALERT POLICY] Could not read alert preferences — sending the ${event} alert anyway: ${error.message}`);
  }
  return shouldSendOwnerAlert(prefs, event);
}

module.exports = {
  shouldSendOwnerAlert,
  ownerWantsAlert,
  SWITCH_FOR_EVENT,
  MASTER_SWITCH
};
