/** Derived statistics for the dashboard views. */

export function latestOf(rows) {
  return rows.length ? rows[rows.length - 1] : null;
}

export function firstOf(rows) {
  return rows.length ? rows[0] : null;
}

export function delta(current, baseline) {
  if (current === null || current === undefined || baseline === null || baseline === undefined) {
    return null;
  }
  return current - baseline;
}

export function average(values) {
  const nums = values.filter((v) => v !== null && v !== undefined);
  if (!nums.length) {
    return null;
  }
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export function sum(values) {
  const nums = values.filter((v) => v !== null && v !== undefined);
  if (!nums.length) {
    return null;
  }
  return nums.reduce((total, v) => total + v, 0);
}

/** Rows whose date is within the last `days` days counting back from the latest row. */
export function recentRows(rows, days) {
  if (!rows.length) {
    return [];
  }
  const latest = rows[rows.length - 1].date;
  const latestMs = Date.parse(latest);
  const threshold = latestMs - (days - 1) * 24 * 60 * 60 * 1000;
  return rows.filter((row) => Date.parse(row.date) >= threshold);
}

/** Distance remaining from the latest weight to a goal weight (negative when passed). */
export function remainingToGoal(latestWeightKg, goalKg) {
  if (latestWeightKg === null || latestWeightKg === undefined || goalKg === null || goalKg === undefined) {
    return null;
  }
  return latestWeightKg - goalKg;
}

/** Progress from start weight toward a goal weight, as a 0-100 percentage. */
export function goalProgressPercent(startKg, latestKg, goalKg) {
  if (
    startKg === null || startKg === undefined
    || latestKg === null || latestKg === undefined
    || goalKg === null || goalKg === undefined
    || startKg === goalKg
  ) {
    return null;
  }
  const pct = ((startKg - latestKg) / (startKg - goalKg)) * 100;
  return Math.min(100, Math.max(0, pct));
}
