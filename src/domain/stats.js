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

/** Energy equivalent used for weight prediction: 7,700 kcal ≈ 1 kg of body fat. */
export const KCAL_PER_KG = 7700;

export function addDays(dateStr, days) {
  const ms = Date.parse(dateStr) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Predicted weight after `days` days at a constant daily calorie balance. */
export function predictWeightKg(latestWeightKg, avgDailyBalanceKcal, days) {
  if (
    latestWeightKg === null || latestWeightKg === undefined
    || avgDailyBalanceKcal === null || avgDailyBalanceKcal === undefined
  ) {
    return null;
  }
  return latestWeightKg + (avgDailyBalanceKcal * days) / KCAL_PER_KG;
}

/** Days needed to reach a goal weight at a constant daily balance (null when not reachable). */
export function daysToGoalWeight(latestWeightKg, goalKg, avgDailyBalanceKcal) {
  if (
    latestWeightKg === null || latestWeightKg === undefined
    || goalKg === null || goalKg === undefined
    || avgDailyBalanceKcal === null || avgDailyBalanceKcal === undefined
  ) {
    return null;
  }
  if (latestWeightKg <= goalKg) {
    return 0;
  }
  if (avgDailyBalanceKcal >= 0) {
    return null;
  }
  return Math.ceil(((latestWeightKg - goalKg) * KCAL_PER_KG) / -avgDailyBalanceKcal);
}

/** Estimated date on which a goal weight is reached (null when not reachable). */
export function goalReachDate(fromDate, latestWeightKg, goalKg, avgDailyBalanceKcal) {
  const days = daysToGoalWeight(latestWeightKg, goalKg, avgDailyBalanceKcal);
  if (days === null) {
    return null;
  }
  return addDays(fromDate, days);
}

/** Projection points from the latest measurement into the future. */
export function projectionPoints(latest, avgDailyBalanceKcal, horizonDays = 90, stepDays = 15) {
  if (!latest || avgDailyBalanceKcal === null || avgDailyBalanceKcal === undefined) {
    return [];
  }
  const points = [{ date: latest.date, value: latest.weightKg }];
  for (let d = stepDays; d <= horizonDays; d += stepDays) {
    points.push({
      date: addDays(latest.date, d),
      value: predictWeightKg(latest.weightKg, avgDailyBalanceKcal, d),
    });
  }
  return points;
}
