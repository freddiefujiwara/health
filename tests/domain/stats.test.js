import { describe, expect, it } from "vitest";
import {
  addDays,
  average,
  daysToGoalWeight,
  empiricalKcalPerKg,
  firstOf,
  goalProgressPercent,
  goalReachDate,
  latestOf,
  movingAverage,
  predictWeightKg,
  projectionPoints,
  recentRows,
  remainingToGoal,
  sum,
  trendLinePoints,
  weeklyBalanceProjection,
} from "../../src/domain/stats";

describe("stats helpers", () => {
  it("movingAverage averages a trailing window and tolerates nulls", () => {
    expect(movingAverage([60, 120, 180], 7)).toEqual([60, 90, 120]);
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35]);
    expect(movingAverage([null, 100], 7)).toEqual([null, 100]);
    expect(movingAverage([], 7)).toEqual([]);
  });

  it("picks first / latest rows", () => {
    expect(firstOf([])).toBeNull();
    expect(latestOf([])).toBeNull();
    const rows = [{ date: "2026-01-01" }, { date: "2026-01-02" }];
    expect(firstOf(rows).date).toBe("2026-01-01");
    expect(latestOf(rows).date).toBe("2026-01-02");
  });

  it("averages and sums ignoring missing values", () => {
    expect(average([100, null, 300, undefined])).toBe(200);
    expect(average([])).toBeNull();
    expect(average([null])).toBeNull();
    expect(sum([1, 2, null])).toBe(3);
    expect(sum([])).toBeNull();
  });

  it("selects recent rows relative to the latest date", () => {
    const rows = [
      { date: "2026-10-01" },
      { date: "2026-10-25" },
      { date: "2026-10-31" },
    ];
    expect(recentRows(rows, 7).map((r) => r.date)).toEqual(["2026-10-25", "2026-10-31"]);
    expect(recentRows([], 7)).toEqual([]);
    expect(recentRows(rows, 31)).toHaveLength(3);
  });

  it("computes remaining distance and progress toward a goal", () => {
    expect(remainingToGoal(91.5, 80)).toBeCloseTo(11.5);
    expect(remainingToGoal(null, 80)).toBeNull();
    expect(remainingToGoal(91.5, null)).toBeNull();
    expect(goalProgressPercent(99.7, 91.5, 80)).toBeCloseTo(41.6, 0);
    expect(goalProgressPercent(100, 120, 80)).toBe(0);
    expect(goalProgressPercent(100, 60, 80)).toBe(100);
    expect(goalProgressPercent(null, 90, 80)).toBeNull();
    expect(goalProgressPercent(100, null, 80)).toBeNull();
    expect(goalProgressPercent(100, 90, null)).toBeNull();
    expect(goalProgressPercent(80, 80, 80)).toBeNull();
  });
});

describe("weight prediction", () => {
  it("adds days to a date", () => {
    expect(addDays("2026-10-17", 30)).toBe("2026-11-16");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("predicts weight from an average daily balance", () => {
    expect(predictWeightKg(90, -770, 10)).toBeCloseTo(89);
    expect(predictWeightKg(90, 770, 10)).toBeCloseTo(91);
    expect(predictWeightKg(null, -770, 10)).toBeNull();
    expect(predictWeightKg(90, null, 10)).toBeNull();
    expect(predictWeightKg(90, undefined, 10)).toBeNull();
  });

  it("computes days to a goal weight", () => {
    expect(daysToGoalWeight(91.5, 90, -750)).toBe(16);
    expect(daysToGoalWeight(89, 90, -750)).toBe(0);
    expect(daysToGoalWeight(91.5, 90, 0)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, 100)).toBeNull();
    expect(daysToGoalWeight(null, 90, -750)).toBeNull();
    expect(daysToGoalWeight(91.5, null, -750)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, null)).toBeNull();
  });

  it("computes the goal reach date", () => {
    expect(goalReachDate("2026-10-17", 91.5, 90, -750)).toBe("2026-11-02");
    expect(goalReachDate("2026-10-17", 91.5, 90, 0)).toBeNull();
    expect(goalReachDate("2026-10-17", 89, 90, -750)).toBe("2026-10-17");
  });

  it("builds projection points", () => {
    const pts = projectionPoints({ date: "2026-10-17", weightKg: 91.5 }, -770, 30, 15);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ date: "2026-10-17", value: 91.5 });
    expect(pts[2].date).toBe("2026-11-16");
    expect(pts[2].value).toBeCloseTo(88.5);
    expect(projectionPoints(null, -770)).toEqual([]);
    expect(projectionPoints({ date: "2026-10-17", weightKg: 91.5 }, null)).toEqual([]);
  });

  it("honours a custom kcal-per-kg factor", () => {
    expect(predictWeightKg(90, -1000, 10, 10000)).toBeCloseTo(89);
    expect(daysToGoalWeight(92, 90, -500, 10000)).toBe(40);
    const pts = projectionPoints({ date: "2026-10-17", weightKg: 91.5 }, -1000, 30, 15, 10000);
    expect(pts[2].value).toBeCloseTo(88.5);
  });
});

describe("empiricalKcalPerKg", () => {
  const body = [
    { date: "2026-07-25", weightKg: 99.7 },
    { date: "2026-08-29", weightKg: 95.7 },
    { date: "2026-10-17", weightKg: 91.5 },
  ];
  const nutrition = [
    { date: "2026-08-23", balanceKcal: -936, completeness: "完了" },
    { date: "2026-08-30", balanceKcal: -20000, completeness: "完了" },
    { date: "2026-09-15T00:00:00+09:00", balanceKcal: -10000, completeness: "完了" },
    { date: "2026-10-17", balanceKcal: -11950, completeness: "完了" },
    { date: "2026-10-18", balanceKcal: -500, completeness: "途中（当日分）" },
  ];

  it("derives kcal per kg from the balance between in-range measurements", () => {
    const result = empiricalKcalPerKg(body, nutrition);
    expect(result.fromDate).toBe("2026-08-29");
    expect(result.toDate).toBe("2026-10-17");
    expect(result.totalBalanceKcal).toBe(-41950);
    expect(result.weightLossKg).toBeCloseTo(4.2);
    expect(result.kcalPerKg).toBe(9988);
  });

  it("returns null without two in-range measurements", () => {
    expect(empiricalKcalPerKg([body[0]], nutrition)).toBeNull();
    expect(empiricalKcalPerKg(body, [])).toBeNull();
    expect(empiricalKcalPerKg([], nutrition)).toBeNull();
  });

  it("returns null when there is no loss or no deficit", () => {
    const gained = [
      { date: "2026-08-29", weightKg: 91.5 },
      { date: "2026-10-17", weightKg: 95.7 },
    ];
    expect(empiricalKcalPerKg(gained, nutrition)).toBeNull();
    const surplus = nutrition.map((row) => ({ ...row, balanceKcal: 100 }));
    expect(empiricalKcalPerKg(body, surplus)).toBeNull();
  });

  it("returns null when both measurements share one date", () => {
    const sameDay = [
      { date: "2026-08-29", weightKg: 95.7 },
      { date: "2026-08-29", weightKg: 95.0 },
    ];
    expect(empiricalKcalPerKg(sameDay, nutrition)).toBeNull();
  });

  it("returns null when no completed day falls inside the span", () => {
    const outside = [
      { date: "2026-08-23", balanceKcal: -936, completeness: "完了" },
      { date: "2026-12-01", balanceKcal: -500, completeness: "完了" },
    ];
    expect(empiricalKcalPerKg(body, outside)).toBeNull();
  });

  it("tolerates messy rows and unsorted input", () => {
    const messyBody = [
      null,
      { date: "2026-10-17", weightKg: 91.5 },
      { date: "2026-08-29", weightKg: null },
      { date: "2026-08-29", weightKg: 95.7 },
    ];
    const messyNutrition = [
      null,
      { balanceKcal: -100, completeness: "完了" },
      { date: "2026-09-01", balanceKcal: NaN, completeness: "完了" },
      { date: "2026-09-02", balanceKcal: -41950, completeness: "完了" },
    ];
    const result = empiricalKcalPerKg(messyBody, messyNutrition);
    expect(result.kcalPerKg).toBe(9988);
    const dateless = empiricalKcalPerKg([...body, { weightKg: 50 }], nutrition);
    expect(dateless.kcalPerKg).toBe(9988);
    expect(empiricalKcalPerKg(null, null)).toBeNull();
    expect(empiricalKcalPerKg(undefined, undefined)).toBeNull();
    expect(empiricalKcalPerKg(null, nutrition)).toBeNull();
    expect(empiricalKcalPerKg(undefined, nutrition)).toBeNull();
  });
});

describe("weeklyBalanceProjection", () => {
  const latest = { date: "2026-10-17", weightKg: 100 };
  const nutrition = [
    { date: "2026-11-14", balanceKcal: -1500, completeness: "完了" },
    { date: "2026-10-17", balanceKcal: -5000, completeness: "完了" },
    { date: "2026-10-20", balanceKcal: -3000, completeness: "完了" },
    { date: "2026-10-24", balanceKcal: -4000, completeness: "完了" },
    { date: "2026-10-31", balanceKcal: -3500, completeness: "完了" },
    { date: "2026-11-05", balanceKcal: -2000, completeness: "完了" },
    { date: "2026-11-15", balanceKcal: -999, completeness: "途中（当日分）" },
  ];
  const rounded = (points) =>
    points.map((p) => ({ date: p.date, value: Math.round(p.value * 100) / 100 }));

  it("piles up actual weekly balances, then forecasts the no-data stretch in grey", () => {
    const { dataPoints, forecastPoints } = weeklyBalanceProjection(latest, nutrition, -500, 10000);
    expect(rounded(dataPoints)).toEqual([
      { date: "2026-10-17", value: 100 },
      { date: "2026-10-24", value: 99.3 },
      { date: "2026-10-31", value: 98.95 },
      { date: "2026-11-07", value: 98.75 },
      { date: "2026-11-14", value: 98.6 },
    ]);
    expect(rounded(forecastPoints)).toEqual([
      { date: "2026-11-14", value: 98.6 },
      { date: "2026-11-21", value: 98.25 },
      { date: "2026-11-28", value: 97.9 },
      { date: "2026-12-05", value: 97.55 },
      { date: "2026-12-12", value: 97.2 },
      { date: "2026-12-19", value: 96.85 },
      { date: "2026-12-26", value: 96.5 },
      { date: "2027-01-02", value: 96.15 },
      { date: "2027-01-09", value: 95.8 },
      { date: "2027-01-16", value: 95.45 },
    ]);
  });

  it("returns empty series without a latest measurement", () => {
    expect(weeklyBalanceProjection(null, nutrition, -500, 10000)).toEqual({
      dataPoints: [],
      forecastPoints: [],
    });
  });

  it("forecasts from the anchor when there is no recorded balance after it", () => {
    const before = [
      { date: "2026-10-10", balanceKcal: -800, completeness: "完了" },
    ];
    const { dataPoints, forecastPoints } = weeklyBalanceProjection(latest, before, -500, 10000);
    expect(dataPoints).toEqual([{ date: "2026-10-17", value: 100 }]);
    expect(forecastPoints).toHaveLength(14);
    expect(forecastPoints[0]).toEqual({ date: "2026-10-17", value: 100 });
    const empty = weeklyBalanceProjection(latest, [], -500, 10000);
    expect(empty.dataPoints).toEqual([{ date: "2026-10-17", value: 100 }]);
    expect(empty.forecastPoints).toHaveLength(14);
    const nullRows = weeklyBalanceProjection(latest, null, -500, 10000);
    expect(nullRows.forecastPoints).toHaveLength(14);
  });

  it("omits the forecast when the average balance is unknown", () => {
    expect(weeklyBalanceProjection(latest, nutrition, null, 10000).forecastPoints).toEqual([]);
    expect(weeklyBalanceProjection(latest, nutrition, undefined, 10000).forecastPoints).toEqual([]);
  });

  it("keeps every step green when data covers the whole horizon", () => {
    const full = [
      { date: "2027-03-01", balanceKcal: -7000, completeness: "完了" },
    ];
    const { dataPoints, forecastPoints } = weeklyBalanceProjection(latest, full, -500, 10000);
    expect(dataPoints).toHaveLength(14);
    expect(forecastPoints).toHaveLength(1);
  });

  it("uses the default 7,700 kcal/kg factor when none is given", () => {
    const { dataPoints } = weeklyBalanceProjection(latest, nutrition, -500);
    expect(dataPoints[1].value).toBeCloseTo(100 - 7000 / 7700);
  });

  it("tolerates messy rows", () => {
    const messy = [
      null,
      { balanceKcal: -100, completeness: "完了" },
      { date: "2026-10-20", balanceKcal: NaN, completeness: "完了" },
      { date: "2026-10-24T00:00:00+09:00", balanceKcal: -7000, completeness: "完了" },
    ];
    const { dataPoints, forecastPoints } = weeklyBalanceProjection(latest, messy, -500, 10000);
    expect(rounded(dataPoints)).toEqual([
      { date: "2026-10-17", value: 100 },
      { date: "2026-10-24", value: 99.3 },
    ]);
    expect(forecastPoints[0]).toEqual(dataPoints[dataPoints.length - 1]);
  });
});

describe("trendLinePoints", () => {
  it("returns [] for fewer than 2 usable points", () => {
    expect(trendLinePoints([])).toEqual([]);
    expect(trendLinePoints([{ date: "2026-08-24", value: -847 }])).toEqual([]);
    expect(trendLinePoints([{ date: "2026-08-24", value: null }, { date: "2026-08-31", value: null }])).toEqual([]);
    expect(trendLinePoints(null)).toEqual([]);
  });

  it("fits a perfect line exactly", () => {
    const points = [
      { date: "2026-08-24", value: 100 },
      { date: "2026-08-31", value: 200 },
      { date: "2026-09-07", value: 300 },
    ];
    expect(trendLinePoints(points)).toEqual([
      { date: "2026-08-24", value: 100 },
      { date: "2026-09-07", value: 300 },
    ]);
  });

  it("fits the least-squares line through noisy weekly points", () => {
    const points = [
      { date: "2026-08-24", value: -847 },
      { date: "2026-08-31", value: -910 },
      { date: "2026-09-07", value: -800 },
    ];
    expect(trendLinePoints(points)).toEqual([
      { date: "2026-08-24", value: -876 },
      { date: "2026-09-07", value: -829 },
    ]);
  });

  it("is flat when all points share one date", () => {
    const points = [
      { date: "2026-08-24", value: 100 },
      { date: "2026-08-24", value: 300 },
    ];
    expect(trendLinePoints(points)).toEqual([
      { date: "2026-08-24", value: 200 },
      { date: "2026-08-24", value: 200 },
    ]);
  });
});
