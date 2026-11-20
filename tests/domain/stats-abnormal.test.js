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
  weekdayIntakeAverages,
  weeklyBalanceProjection,
} from "../../src/domain/stats";

// Abnormal-case tests for the derived statistics. The contract: a
// deformed value degrades to the module's missing value (null / [] /
// ""), and no NaN or Infinity ever leaks into an average, a prediction
// or a chart series — the views print and plot these numbers directly.
const badToString = { toString: [] };

describe("average / sum / movingAverage with deformed values", () => {
  it("ignores NaN and infinities instead of leaking them", () => {
    expect(average([Number.NaN])).toBeNull();
    expect(average([Number.NaN, 100, 300])).toBe(200);
    expect(average([Number.POSITIVE_INFINITY, 100])).toBe(100);
    expect(average([Number.NEGATIVE_INFINITY])).toBeNull();
    expect(sum([Number.POSITIVE_INFINITY])).toBeNull();
    expect(sum([Number.NaN, 1, 2])).toBe(3);
  });

  it("ignores non-numeric values instead of concatenating or coercing them", () => {
    expect(average(["5", 1])).toBe(1);
    expect(sum(["5"])).toBeNull();
    expect(sum([true, 2])).toBe(2);
    expect(average([{}, 10])).toBe(10);
    expect(average([badToString, 10])).toBe(10);
  });

  it("keeps moving averages free of NaN and Infinity", () => {
    expect(movingAverage([Number.NaN, 100, 200], 2)).toEqual([null, 100, 150]);
    expect(movingAverage([Number.POSITIVE_INFINITY], 7)).toEqual([null]);
    expect(movingAverage(["5", 10], 2)).toEqual([null, 10]);
  });
});

describe("row pickers with missing input", () => {
  it("tolerates null / undefined row lists", () => {
    expect(latestOf(null)).toBeNull();
    expect(latestOf(undefined)).toBeNull();
    expect(firstOf(null)).toBeNull();
    expect(firstOf(undefined)).toBeNull();
    expect(recentRows(null, 7)).toEqual([]);
    expect(recentRows(undefined, 7)).toEqual([]);
  });

  it("returns no recent rows when the latest date is unparseable", () => {
    const rows = [{ date: "2026-10-01" }, { date: "garbage" }];
    expect(recentRows(rows, 7)).toEqual([]);
  });
});

describe("goal math with deformed numbers", () => {
  it("reads non-finite inputs as missing", () => {
    expect(remainingToGoal(Number.NaN, 80)).toBeNull();
    expect(remainingToGoal(90, Number.NaN)).toBeNull();
    expect(remainingToGoal(Number.POSITIVE_INFINITY, 80)).toBeNull();
    expect(goalProgressPercent(Number.NaN, 90, 80)).toBeNull();
    expect(goalProgressPercent(100, 90, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("never predicts with a non-positive or non-finite kcal-per-kg factor", () => {
    expect(predictWeightKg(90, -770, 10, 0)).toBeNull();
    expect(predictWeightKg(90, -770, 10, -7700)).toBeNull();
    expect(predictWeightKg(90, -770, 10, Number.NaN)).toBeNull();
    expect(predictWeightKg(90, -770, 10, Number.POSITIVE_INFINITY)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, -750, 0)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, -750, -7700)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, -750, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("reads a non-finite balance or weight as missing", () => {
    expect(predictWeightKg(90, Number.NaN, 10)).toBeNull();
    expect(predictWeightKg(Number.NaN, -770, 10)).toBeNull();
    expect(predictWeightKg(90, -770, Number.NaN)).toBeNull();
    expect(daysToGoalWeight(91.5, 90, Number.NaN)).toBeNull();
  });
});

describe("date arithmetic with deformed dates", () => {
  it("returns an empty string for unparseable dates instead of throwing", () => {
    expect(addDays("garbage", 5)).toBe("");
    expect(addDays("", 5)).toBe("");
    expect(addDays(null, 5)).toBe("");
    expect(addDays(undefined, 5)).toBe("");
    expect(addDays(badToString, 5)).toBe("");
  });

  it("propagates the empty fallback through goalReachDate", () => {
    expect(goalReachDate("garbage", 91.5, 90, -750)).toBe("");
    expect(goalReachDate("2026-10-17", 91.5, 90, -750)).toBe("2026-11-02");
  });

  it("excludes points with unparseable dates from the trend line", () => {
    const points = [
      { date: "garbage", value: 999 },
      { date: 20260824, value: 50 },
      { date: "2026-08-24", value: 100 },
      { date: "2026-08-31", value: 200 },
    ];
    expect(trendLinePoints(points)).toEqual([
      { date: "2026-08-24", value: 100 },
      { date: "2026-08-31", value: 200 },
    ]);
    expect(trendLinePoints([
      { date: "garbage", value: 100 },
      { date: "junk", value: 200 },
    ])).toEqual([]);
  });
});

describe("projections with deformed inputs", () => {
  const latest = { date: "2026-10-17", weightKg: 100 };
  const nutrition = [
    { date: "2026-10-20", balanceKcal: -3000, completeness: "完了" },
    { date: "2026-10-24", balanceKcal: -4000, completeness: "完了" },
  ];

  it("keeps every projected value finite when the kcal-per-kg factor is unusable", () => {
    for (const factor of [0, -7700, Number.NaN]) {
      const { dataPoints, forecastPoints } = weeklyBalanceProjection(latest, nutrition, -500, factor);
      expect(dataPoints[0]).toEqual({ date: "2026-10-17", value: 100 });
      for (const point of [...dataPoints, ...forecastPoints]) {
        expect(Number.isFinite(point.value)).toBe(true);
      }
    }
    const points = projectionPoints(latest, -770, 30, 15, 0);
    for (const point of points) {
      expect(point.value === null || Number.isFinite(point.value)).toBe(true);
    }
  });

  it("omits the forecast when the average balance is not finite", () => {
    const { forecastPoints } = weeklyBalanceProjection(latest, nutrition, Number.NaN, 10000);
    expect(forecastPoints).toEqual([]);
    const infinite = weeklyBalanceProjection(latest, nutrition, Number.POSITIVE_INFINITY, 10000);
    for (const point of infinite.forecastPoints) {
      expect(Number.isFinite(point.value)).toBe(true);
    }
  });

  it("does not throw on an unparseable anchor date", () => {
    const result = weeklyBalanceProjection({ date: "garbage", weightKg: 100 }, nutrition, -500, 10000);
    expect(Array.isArray(result.dataPoints)).toBe(true);
    expect(Array.isArray(result.forecastPoints)).toBe(true);
  });

  it("survives rows whose dates cannot be stringified", () => {
    const body = [
      { date: "2026-08-29", weightKg: 95.7 },
      { date: "2026-10-17", weightKg: 91.5 },
    ];
    const weirdNutrition = [
      { date: badToString, balanceKcal: -500, completeness: "完了" },
      { date: "2026-09-02", balanceKcal: -41950, completeness: "完了" },
    ];
    expect(() => empiricalKcalPerKg(body, weirdNutrition)).not.toThrow();
    expect(empiricalKcalPerKg(body, weirdNutrition).kcalPerKg).toBe(9988);
    expect(() => weekdayIntakeAverages(weirdNutrition)).not.toThrow();
    expect(weekdayIntakeAverages(weirdNutrition)).toHaveLength(7);
    expect(() =>
      weeklyBalanceProjection(latest, weirdNutrition, -500, 10000),
    ).not.toThrow();
  });
});
