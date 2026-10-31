import { describe, expect, it } from "vitest";
import {
  average,
  delta,
  firstOf,
  goalProgressPercent,
  latestOf,
  recentRows,
  remainingToGoal,
  sum,
} from "./stats";

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
