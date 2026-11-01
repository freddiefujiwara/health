import { describe, expect, it } from "vitest";
import {
  addDays,
  average,
  daysToGoalWeight,
  delta,
  firstOf,
  goalProgressPercent,
  goalReachDate,
  latestOf,
  predictWeightKg,
  projectionPoints,
  recentRows,
  remainingToGoal,
  sum,
} from "../../src/domain/stats";

describe("stats helpers", () => {
  it("picks first / latest rows", () => {
    expect(firstOf([])).toBeNull();
    expect(latestOf([])).toBeNull();
    const rows = [{ date: "2026-01-01" }, { date: "2026-01-02" }];
    expect(firstOf(rows).date).toBe("2026-01-01");
    expect(latestOf(rows).date).toBe("2026-01-02");
  });

  it("computes delta with null safety", () => {
    expect(delta(91.5, 99.7)).toBeCloseTo(-8.2);
    expect(delta(null, 1)).toBeNull();
    expect(delta(1, undefined)).toBeNull();
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
});
