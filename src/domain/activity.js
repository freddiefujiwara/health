import { formatDurationMinutes } from "./format";

// Hours counted as late-night activity (23:00-04:29), matching the
// window used for the late-night message counts.
const LATE_NIGHT_HOURS = [23, 0, 1, 2, 3, 4];

/** Minutes of late-night activity per calendar date, as a Map. */
export function lateNightMinutesByDate(dailyHourRows, serverTotals = []) {
  const map = new Map();
  // Server-computed totals cover the whole history; the hourly rows
  // (which may only span a recent window) override the dates they cover.
  for (const row of serverTotals ?? []) {
    if (!row || !row.date || !Number.isFinite(row.minutes)) {
      continue;
    }
    map.set(row.date, row.minutes);
  }
  const rowTotals = new Map();
  for (const row of dailyHourRows ?? []) {
    if (!row || !LATE_NIGHT_HOURS.includes(row.hour)) {
      continue;
    }
    // A non-numeric estimate counts as 0: adding it raw would
    // concatenate strings into the total or throw on odd objects.
    const minutes = Number.isFinite(row.engagedMinutesEst) ? row.engagedMinutesEst : 0;
    rowTotals.set(row.date, (rowTotals.get(row.date) ?? 0) + minutes);
  }
  for (const [date, minutes] of rowTotals) {
    map.set(date, minutes);
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
/** "08:56" style label for a minute-of-day value (1440 -> "24:00"). */
function minuteOfDayLabel(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/**
 * Bands (in fractional hours) for one calendar day from day segments
 * of one state. Segments are already clipped to their day, so unlike
 * sleep they never straddle midnight.
 */
function segmentBandsForDay(segments, day, state, color) {
  const result = [];
  for (const seg of segments ?? []) {
    if (!seg || seg.date !== day || seg.state !== state) {
      continue;
    }
    if (!Number.isFinite(seg.startMinute) || !Number.isFinite(seg.endMinute)) {
      continue;
    }
    const minutes = seg.endMinute - seg.startMinute;
    result.push({
      from: seg.startMinute / 60,
      to: seg.endMinute / 60,
      label: formatDurationMinutes(minutes),
      note: `${minuteOfDayLabel(seg.startMinute)}–${minuteOfDayLabel(seg.endMinute)}、${formatDurationMinutes(minutes)}`,
      color,
    });
  }
  return result;
}

/** Out-of-home bands for one calendar day, from the home/out segments. */
export function outBandsForDay(segments, day) {
  return segmentBandsForDay(segments, day, "out", "#38bdf8");
}

/** At-work bands for one calendar day, from the work segments. */
export function workBandsForDay(segments, day) {
  return segmentBandsForDay(segments, day, "work", "#22c55e");
}

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
