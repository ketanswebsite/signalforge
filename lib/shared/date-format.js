/**
 * Shared user-facing date formatting — DD-MM-YYYY across Telegram messages and
 * any server-rendered strings. Display only: storage, SQL, and API payloads
 * stay ISO. Defaults to Europe/London so output is stable regardless of the
 * server's own timezone (Render runs UTC, local dev runs Asia/Kolkata).
 */

function partsInTZ(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const map = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return map;
}

function formatDateDDMMYYYY(date, timeZone = 'Europe/London') {
  const p = partsInTZ(date, timeZone);
  return p ? `${p.day}-${p.month}-${p.year}` : '';
}

function formatDateTimeUK(date, timeZone = 'Europe/London') {
  const p = partsInTZ(date, timeZone);
  return p ? `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}` : '';
}

/**
 * London wall-clock parts of an instant. hourCycle h23 keeps midnight at "00", never "24".
 */
function londonParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/**
 * The time in London as "DD/MM/YYYY, HH:MM:SS". It formats the real instant once. Shifting a
 * Date to UK wall time and then formatting that in London again counts British Summer Time
 * twice: /health ran an hour ahead all summer that way.
 */
function formatUKClock(date = new Date()) {
  const p = londonParts(date);
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * The next run of a weekday (Mon-Fri) job scheduled at `hour`:00 London time, in the
 * formatUKClock shape. Once that hour has started, today's run counts as taken.
 */
function nextUKWeekdayRun(now = new Date(), hour = 7) {
  const p = londonParts(now);
  const day = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  if (+p.hour >= hour) day.setUTCDate(day.getUTCDate() + 1);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  const two = n => String(n).padStart(2, '0');
  return `${two(day.getUTCDate())}/${two(day.getUTCMonth() + 1)}/${day.getUTCFullYear()}, ${two(hour)}:00:00`;
}

module.exports = { formatDateDDMMYYYY, formatDateTimeUK, formatUKClock, nextUKWeekdayRun };
