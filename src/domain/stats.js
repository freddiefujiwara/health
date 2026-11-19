/** Derived statistics for the dashboard views. */

export function latestOf(rows) {
  return rows.length ? rows[rows.length - 1] : null;
}

export function firstOf(rows) {
  return rows.length ? rows[0] : null;
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

/** Trailing moving average: entry i averages values[max(0, i-windowSize+1)..i], ignoring nulls. */
export function movingAverage(values, windowSize) {
  return values.map((_, i) => average(values.slice(Math.max(0, i - windowSize + 1), i + 1)));
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

const date10 = (value) => String(value ?? "").slice(0, 10);

/**
 * Empirical energy equivalent derived from the recorded data: the total
 * calorie balance between the first and latest body-composition
 * measurements that fall inside the nutrition record, divided by the
 * weight lost over the same span. Returns null when the data cannot
 * support the estimate (too few measurements, no deficit, no loss).
 */
export function empiricalKcalPerKg(bodyRows, nutritionRows) {
  const completed = (nutritionRows ?? []).filter(
    (row) => row && row.completeness === "完了" && Number.isFinite(row.balanceKcal),
  );
  if (!completed.length) {
    return null;
  }
  const firstNutritionDate = completed.map((row) => date10(row.date)).sort()[0];
  const anchors = (bodyRows ?? [])
    .filter((row) => row && date10(row.date) >= firstNutritionDate && Number.isFinite(row.weightKg))
    .map((row) => ({ date: date10(row.date), weightKg: row.weightKg }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (anchors.length < 2) {
    return null;
  }
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first.date === last.date) {
    return null;
  }
  const totalBalanceKcal = sum(
    completed
      .filter((row) => date10(row.date) > first.date && date10(row.date) <= last.date)
      .map((row) => row.balanceKcal),
  );
  const weightLossKg = first.weightKg - last.weightKg;
  if (totalBalanceKcal === null || totalBalanceKcal >= 0 || weightLossKg <= 0) {
    return null;
  }
  return {
    kcalPerKg: Math.round(-totalBalanceKcal / weightLossKg),
    fromDate: first.date,
    toDate: last.date,
    totalBalanceKcal,
    weightLossKg,
  };
}

/**
 * Weekly predicted-weight points from the latest measurement.
 * `dataPoints` pile up the recorded daily balances week by week, so the
 * line follows the actual intake/expenditure rhythm. Once the recorded
 * (completed) days run out, `forecastPoints` continue from the last data
 * point at a constant average daily balance — the stretch with no data.
 */
export function weeklyBalanceProjection(
  latest,
  nutritionRows,
  avgDailyBalanceKcal,
  kcalPerKg = KCAL_PER_KG,
  horizonDays = 91,
  stepDays = 7,
) {
  if (!latest) {
    return { dataPoints: [], forecastPoints: [] };
  }
  const anchor = { date: date10(latest.date), value: latest.weightKg };
  const completed = (nutritionRows ?? [])
    .filter(
      (row) => row && row.completeness === "完了" && Number.isFinite(row.balanceKcal),
    )
    .map((row) => ({ date: date10(row.date), balanceKcal: row.balanceKcal }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastCompletedDate = completed.length
    ? completed[completed.length - 1].date
    : null;

  const dataPoints = [anchor];
  let cumulative = 0;
  let cursor = 0;
  let lastStep = 0;
  for (let d = stepDays; d <= horizonDays; d += stepDays) {
    const stepDate = addDays(anchor.date, d);
    if (lastCompletedDate === null || stepDate > lastCompletedDate) {
      break;
    }
    while (cursor < completed.length && completed[cursor].date <= stepDate) {
      if (completed[cursor].date > anchor.date) {
        cumulative += completed[cursor].balanceKcal;
      }
      cursor += 1;
    }
    dataPoints.push({
      date: stepDate,
      value: anchor.value + cumulative / kcalPerKg,
    });
    lastStep = d;
  }

  const forecastPoints = [];
  if (avgDailyBalanceKcal !== null && avgDailyBalanceKcal !== undefined) {
    const lastData = dataPoints[dataPoints.length - 1];
    forecastPoints.push(lastData);
    for (let d = lastStep + stepDays; d <= horizonDays; d += stepDays) {
      forecastPoints.push({
        date: addDays(anchor.date, d),
        value: lastData.value + (avgDailyBalanceKcal * (d - lastStep)) / kcalPerKg,
      });
    }
  }
  return { dataPoints, forecastPoints };
}

export function addDays(dateStr, days) {
  const ms = Date.parse(dateStr) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Predicted weight after `days` days at a constant daily calorie balance. */
export function predictWeightKg(latestWeightKg, avgDailyBalanceKcal, days, kcalPerKg = KCAL_PER_KG) {
  if (
    latestWeightKg === null || latestWeightKg === undefined
    || avgDailyBalanceKcal === null || avgDailyBalanceKcal === undefined
  ) {
    return null;
  }
  return latestWeightKg + (avgDailyBalanceKcal * days) / kcalPerKg;
}

/** Days needed to reach a goal weight at a constant daily balance (null when not reachable). */
export function daysToGoalWeight(latestWeightKg, goalKg, avgDailyBalanceKcal, kcalPerKg = KCAL_PER_KG) {
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
  return Math.ceil(((latestWeightKg - goalKg) * kcalPerKg) / -avgDailyBalanceKcal);
}

/** Estimated date on which a goal weight is reached (null when not reachable). */
export function goalReachDate(fromDate, latestWeightKg, goalKg, avgDailyBalanceKcal, kcalPerKg = KCAL_PER_KG) {
  const days = daysToGoalWeight(latestWeightKg, goalKg, avgDailyBalanceKcal, kcalPerKg);
  if (days === null) {
    return null;
  }
  return addDays(fromDate, days);
}

/** Projection points from the latest measurement into the future. */
// Least-squares trend line over dated points, returned as the two end
// points (first and last date) so a chart can draw it as a dashed line.
// X is days since the first point, so missing weeks do not distort the
// slope. Returns [] when there are fewer than 2 usable points.
export function trendLinePoints(points) {
  const valid = (points ?? []).filter((p) => p && p.date && Number.isFinite(p.value));
  if (valid.length < 2) {
    return [];
  }
  const dayMs = 86400000;
  const t0 = Date.parse(valid[0].date);
  const xs = valid.map((p) => (Date.parse(p.date) - t0) / dayMs);
  const meanX = xs.reduce((a, b) => a + b, 0) / valid.length;
  const meanY = valid.reduce((sum, p) => sum + p.value, 0) / valid.length;
  let sxy = 0;
  let sxx = 0;
  valid.forEach((p, i) => {
    sxy += (xs[i] - meanX) * (p.value - meanY);
    sxx += (xs[i] - meanX) ** 2;
  });
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  const last = valid.length - 1;
  return [
    { date: valid[0].date, value: Math.round(intercept) },
    { date: valid[last].date, value: Math.round(intercept + slope * xs[last]) },
  ];
}

export function projectionPoints(latest, avgDailyBalanceKcal, horizonDays = 90, stepDays = 15, kcalPerKg = KCAL_PER_KG) {
  if (!latest || avgDailyBalanceKcal === null || avgDailyBalanceKcal === undefined) {
    return [];
  }
  const points = [{ date: latest.date, value: latest.weightKg }];
  for (let d = stepDays; d <= horizonDays; d += stepDays) {
    points.push({
      date: addDays(latest.date, d),
      value: predictWeightKg(latest.weightKg, avgDailyBalanceKcal, d, kcalPerKg),
    });
  }
  return points;
}
