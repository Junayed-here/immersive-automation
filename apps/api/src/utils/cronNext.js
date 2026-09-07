// Computes the next fire time (and validates the expression, below) for a
// standard 5-field cron string by brute-forcing forward minute-by-minute.
// There's no live scheduling library involved at all anymore (see
// apps/api/src/jobs/scheduler.js) - a serverless function can't hold one -
// so this is the only place cron semantics get parsed, and pulling in a
// parsing/tz library just for that wasn't worth a new dependency. Node ships
// full ICU, so Intl.DateTimeFormat already gives correct IANA timezone/DST
// conversion without one.

function parseField(field, min, max) {
  if (field === '*') {
    const all = new Set();
    for (let i = min; i <= max; i += 1) all.add(i);
    return all;
  }

  const values = new Set();
  field.split(',').forEach((part) => {
    const stepMatch = part.match(/^(\*|\d+-\d+|\d+)\/(\d+)$/);
    if (stepMatch) {
      const [, range, stepStr] = stepMatch;
      const step = Number(stepStr);
      const [rangeStart, rangeEnd] = range === '*' ? [min, max] : range.split('-').map(Number);
      for (let i = rangeStart; i <= rangeEnd; i += step) values.add(i);
      return;
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      for (let i = from; i <= to; i += 1) values.add(i);
      return;
    }
    values.add(Number(part));
  });
  return values;
}

const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

// Standalone 5-field validity check, reusing parseField so this stays
// consistent with computeNextRunAt's own parsing - no separate cron library
// needed just to reject malformed expressions before they're saved.
export function isValidCronExpression(expression) {
  if (typeof expression !== 'string') return false;
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  try {
    return parts.every((field, i) => {
      const [min, max] = FIELD_RANGES[i];
      const values = parseField(field, min, max);
      if (values.size === 0) return false;
      return [...values].every((v) => Number.isInteger(v) && v >= min && v <= max);
    });
  } catch {
    return false;
  }
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Wall-clock fields for `instant` as seen in `timeZone` - NOT the server's
// own local timezone, which is what makes this correct for a user-chosen
// schedule timezone regardless of where the server happens to run.
function wallClockParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    month: Number(parts.month),
    day: Number(parts.day),
    // Node's ICU formats midnight as "24" for some locales/options.
    hour: parts.hour === '24' ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday],
  };
}

/**
 * @param {string} expression standard 5-field cron ("m h dom mon dow")
 * @param {Date} from search starts strictly after this instant
 * @param {string|null} timezone IANA zone the schedule is defined in; server-local if omitted
 * @param {number} maxMinutes safety cap on how far forward to search
 * @returns {Date|null} the next matching instant, or null if none found within the cap
 */
export function computeNextRunAt(expression, from = new Date(), timezone = null, maxMinutes = 366 * 24 * 60 * 2) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteField, hourField, domField, monField, dowField] = parts;
  const minutes = parseField(minuteField, 0, 59);
  const hours = parseField(hourField, 0, 23);
  const doms = parseField(domField, 1, 31);
  const months = parseField(monField, 1, 12);
  const dows = parseField(dowField, 0, 6);

  const domRestricted = domField !== '*';
  const dowRestricted = dowField !== '*';
  const zone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Walk forward in real elapsed minutes (epoch math), then read each
  // candidate's wall-clock fields in the target zone - this stays correct
  // across a DST transition, unlike mutating a Date's local getters.
  let cursor = Math.floor(from.getTime() / 60000) * 60000 + 60000;

  for (let i = 0; i < maxMinutes; i += 1) {
    const instant = new Date(cursor);
    const wc = wallClockParts(instant, zone);

    const matchesDom = doms.has(wc.day);
    const matchesDow = dows.has(wc.weekday);
    // Standard cron rule: when both day-of-month and day-of-week are
    // restricted, a match on EITHER is sufficient (they're OR'd, not AND'd).
    const dayMatches = domRestricted && dowRestricted ? matchesDom || matchesDow : matchesDom && matchesDow;

    if (minutes.has(wc.minute) && hours.has(wc.hour) && months.has(wc.month) && dayMatches) {
      return instant;
    }
    cursor += 60000;
  }
  return null;
}
