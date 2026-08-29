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

module.exports = { formatDateDDMMYYYY, formatDateTimeUK };
