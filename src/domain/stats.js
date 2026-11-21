/** Derived statistics for the dashboard views. */

export function latestOf(rows) {
  return rows?.length ? rows[rows.length - 1] : null;
}

export function firstOf(rows) {
  return rows?.length ? rows[0] : null;
}

// Only finite numbers take part: NaN / Infinity manufactured by
// upstream arithmetic, and non-numbers arriving in a deformed
// payload, are read as missing rather than leaking into an average
// or a total (a string would otherwise concatenate, not add).
const finiteNumbers = (values) => values.filter((v) => Number.isFinite(v));

export function average(values) {
  const nums = finiteNumbers(values);
  if (!nums.length) {
    return null;
  }
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export function sum(values) {
  const nums = finiteNumbers(values);
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
  if (!rows?.length) {
    return [];
  }
  const latest = rows[rows.length - 1].date;
  const latestMs = Date.parse(latest);
  const threshold = latestMs - (days - 1) * 24 * 60 * 60 * 1000;
  return rows.filter((row) => Date.parse(row.date) >= threshold);
}

/** Distance remaining from the latest weight to a goal weight (negative when passed). */
export function remainingToGoal(latestWeightKg, goalKg) {
  if (!Number.isFinite(latestWeightKg) || !Number.isFinite(goalKg)) {
    return null;
  }
  return latestWeightKg - goalKg;
}

/** Progress from start weight toward a goal weight, as a 0-100 percentage. */
export function goalProgressPercent(startKg, latestKg, goalKg) {
  if (
    !Number.isFinite(startKg)
    || !Number.isFinite(latestKg)
    || !Number.isFinite(goalKg)
    || startKg === goalKg
  ) {
    return null;
  }
  const pct = ((startKg - latestKg) / (startKg - goalKg)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** Energy equivalent used for weight prediction: 7,700 kcal ≈ 1 kg of body fat. */
export const KCAL_PER_KG = 7700;

// First 10 chars of a date string; anything that is not a string
// (including an object whose toString is not a function, which
// String() would throw on) reads as "".
const date10 = (value) => (typeof value === "string" ? value.slice(0, 10) : "");

// Date.parse without coercion surprises: non-strings are unparseable.
const parseDateMs = (value) => (typeof value === "string" ? Date.parse(value) : Number.NaN);

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
  if (!Number.isFinite(kcalPerKg) || kcalPerKg <= 0) {
    // Without a usable energy equivalent the projection would divide
    // by it and leak Infinity / NaN into the chart; the measured
    // anchor point is all that can honestly be shown.
    return { dataPoints: [anchor], forecastPoints: [] };
  }
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
  if (Number.isFinite(avgDailyBalanceKcal)) {
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

/** Adds days to a YYYY-MM-DD date; "" when the date cannot be parsed. */
export function addDays(dateStr, days) {
  const ms = parseDateMs(dateStr) + days * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(ms)) {
    return "";
  }
  return new Date(ms).toISOString().slice(0, 10);
}

/** Predicted weight after `days` days at a constant daily calorie balance. */
export function predictWeightKg(latestWeightKg, avgDailyBalanceKcal, days, kcalPerKg = KCAL_PER_KG) {
  if (
    !Number.isFinite(latestWeightKg)
    || !Number.isFinite(avgDailyBalanceKcal)
    || !Number.isFinite(days)
    || !Number.isFinite(kcalPerKg)
    || kcalPerKg <= 0
  ) {
    return null;
  }
  return latestWeightKg + (avgDailyBalanceKcal * days) / kcalPerKg;
}

/** Days needed to reach a goal weight at a constant daily balance (null when not reachable). */
export function daysToGoalWeight(latestWeightKg, goalKg, avgDailyBalanceKcal, kcalPerKg = KCAL_PER_KG) {
  if (
    !Number.isFinite(latestWeightKg)
    || !Number.isFinite(goalKg)
    || !Number.isFinite(avgDailyBalanceKcal)
    || !Number.isFinite(kcalPerKg)
    || kcalPerKg <= 0
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
const WEEKDAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"];

// Average intake grouped by weekday, ordered from Saturday — the
// weekly injection day — so the appetite cycle across the week reads
// left to right. Only completed days count.
export function weekdayIntakeAverages(nutritionRows) {
  const byDay = new Map();
  (nutritionRows ?? []).forEach((row) => {
    if (!row || !row.date || row.completeness !== "完了" || !Number.isFinite(row.intakeKcal)) {
      return;
    }
    const day = new Date(`${date10(row.date)}T00:00:00`).getDay();
    if (!byDay.has(day)) {
      byDay.set(day, []);
    }
    byDay.get(day).push(row.intakeKcal);
  });
  return [6, 0, 1, 2, 3, 4, 5].map((day) => {
    const values = byDay.get(day) ?? [];
    return {
      day,
      label: day === 6 ? "土（注射日）" : WEEKDAY_LABELS_JA[day],
      count: values.length,
      averageIntakeKcal: values.length ? Math.round(average(values)) : null,
      values,
    };
  });
}

export function trendLinePoints(points) {
  const valid = (points ?? []).filter(
    (p) => p && p.date && Number.isFinite(p.value) && Number.isFinite(parseDateMs(p.date)),
  );
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

// Metrics compared between the two most recent measurements, in
// display order. downIsGood drives the tone: for fat-related metrics a
// decrease is progress, for muscle / water / SMI a decrease is a
// warning. masked metrics carry kg amounts, which privacy mode hides
// like the other amount values on the page.
const BODY_CHANGE_METRICS = [
  { key: "weightKg", label: "体重", unit: "kg", digits: 1, downIsGood: true, masked: true },
  { key: "fatMassKg", label: "脂肪量", unit: "kg", digits: 1, downIsGood: true, masked: true },
  { key: "muscleMassKg", label: "筋肉量", unit: "kg", digits: 1, downIsGood: false, masked: true },
  { key: "bodyWaterKg", label: "体水分量", unit: "kg", digits: 1, downIsGood: false, masked: true },
  { key: "leanMassKg", label: "除脂肪量", unit: "kg", digits: 1, downIsGood: false, masked: true },
  { key: "bodyFatPercent", label: "体脂肪率", unit: "%", digits: 1, downIsGood: true, masked: false },
  { key: "visceralFatLevel", label: "内臓脂肪レベル", unit: "", digits: 0, downIsGood: true, masked: false },
  { key: "smi", label: "SMI", unit: "", digits: 2, downIsGood: false, masked: false },
];

// Change from the previous measurement to the latest one, so the
// story of a single measurement ("fat flat, muscle and water down")
// is visible at a glance. Rows without a finite weight do not count
// as measurements. Returns null when fewer than two measurements
// exist; metrics missing on either side are skipped.
export function bodyCompositionChanges(rows) {
  const measured = (rows ?? []).filter((r) => r && Number.isFinite(r.weightKg));
  if (measured.length < 2) {
    return null;
  }
  const latest = measured[measured.length - 1];
  const previous = measured[measured.length - 2];
  const changes = [];
  for (const metric of BODY_CHANGE_METRICS) {
    const current = latest[metric.key];
    const before = previous[metric.key];
    if (!Number.isFinite(current) || !Number.isFinite(before)) {
      continue;
    }
    const factor = 10 ** metric.digits;
    const delta = Math.round((current - before) * factor) / factor;
    const tone = delta === 0 ? "flat" : (delta < 0) === metric.downIsGood ? "good" : "warn";
    changes.push({ ...metric, current, delta, tone });
  }
  return { date: latest.date, previousDate: previous.date, changes };
}
