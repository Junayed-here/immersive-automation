function toDayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {number} n
 * @returns {string[]} 'YYYY-MM-DD' keys for the last n days including today, oldest first
 */
export function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(toDayKey(d));
  }
  return days;
}

/**
 * Groups records by the UTC day of `dateField`.
 * @param {object[]} records
 * @param {string} dateField
 * @returns {Map<string, object[]>}
 */
export function bucketByDay(records, dateField) {
  const map = new Map();
  records.forEach((record) => {
    const value = record[dateField];
    if (!value) return;
    const key = toDayKey(new Date(value));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  });
  return map;
}
