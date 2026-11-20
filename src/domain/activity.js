import { formatDurationMinutes } from "./format";

// Hours counted as late-night activity (23:00-04:29), matching the
// window used for the late-night message counts.
const LATE_NIGHT_HOURS = [23, 0, 1, 2, 3, 4];

/** Minutes of late-night activity per calendar date, as a Map. */
export function lateNightMinutesByDate(dailyHourRows) {
  const map = new Map();
  for (const row of dailyHourRows ?? []) {
    if (!row || !LATE_NIGHT_HOURS.includes(row.hour)) {
      continue;
    }
    // A non-numeric estimate counts as 0: adding it raw would
    // concatenate strings into the total or throw on odd objects.
    const minutes = Number.isFinite(row.engagedMinutesEst) ? row.engagedMinutesEst : 0;
    map.set(row.date, (map.get(row.date) ?? 0) + minutes);
  }
  return map;
}

/** "21:09" -> 21.15 (fractional hours); null when there is no time. */
export function timeToHours(t) {
  if (typeof t !== "string") {
    return null;
  }
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  return Number(match[1]) + Number(match[2]) / 60;
}

/** Whole days from one YYYY-MM-DD date to another. */
function dayDiff(from, to) {
  const toUtc = (dateStr) =>
    Date.UTC(...dateStr.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/**
 * Sleep bands (in fractional hours) overlapping one calendar day.
 * A sleep row belongs to its wake date and spans the previous evening
 * (20:00) to that morning (08:00). Both ends follow the same rule: a time
 * of 20:00 or later sits on the previous day, an earlier time on the wake
 * date itself. An interval that ends before midnight (e.g. 21:09-23:47)
 * therefore belongs entirely to the previous evening and must not leak
 * into the wake date's chart.
 */
export function sleepBandsForDay(sleepRows, day) {
  const result = [];
  for (const row of sleepRows ?? []) {
    if (!row) {
      continue;
    }
    const startH = timeToHours(row.sleepStartEst);
    const endH = timeToHours(row.sleepEndEst);
    if (startH === null || endH === null) {
      continue;
    }
    const shift = dayDiff(day, row.date) * 24;
    const start = startH - (startH >= 20 ? 24 : 0) + shift;
    const end = endH - (endH >= 20 ? 24 : 0) + shift;
    const from = Math.max(0, start);
    const to = Math.min(24, end);
    if (from < to) {
      result.push({
        from,
        to,
        label: formatDurationMinutes(row.durationMinutesEst),
        note: `${row.sleepStartEst}–${row.sleepEndEst}、${formatDurationMinutes(row.durationMinutesEst)}`,
      });
    }
  }
  return result;
}
