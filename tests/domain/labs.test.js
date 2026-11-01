import { describe, expect, it } from "vitest";
import { featuredLabSeries, groupLabResults, labItemSeries, labItemUnit, numericLabItems } from "../../src/domain/labs";

const rows = [
  { date: "2026-08-20", panel: "血液検査", item: "γ-GTP", value: 178, valueNumber: 178, unit: "IU/L" },
  { date: "2026-08-20", panel: "血液検査", item: "色調", value: "淡黄色", valueNumber: null, unit: "" },
  { date: "2025-02-06", panel: "血液検査", item: "γ-GTP", value: 334, valueNumber: 334, unit: "IU/L" },
  { date: "2025-02-06", panel: "血液検査", item: "AST", value: 35, valueNumber: 35, unit: "IU/L" },
  { date: "2026-08-20", panel: "血液検査", item: "AST", value: 26, valueNumber: 26, unit: "IU/L" },
  { date: "2024-11-14", panel: "血液検査", item: "γ-GTP", value: 263, valueNumber: 263, unit: "IU/L" },
  { date: "2023-10-12", panel: "血液検査", item: "γ-GTP", value: 261, valueNumber: 261, unit: "IU/L" },
];

describe("lab helpers", () => {
  it("groups by date, newest first", () => {
    const groups = groupLabResults(rows);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-20", "2025-02-06", "2024-11-14", "2023-10-12"]);
    expect(groups[0].panel).toBe("血液検査");
    expect(groups[0].rows).toHaveLength(3);
    expect(groupLabResults([])).toEqual([]);
  });

  it("lists items with at least two numeric values", () => {
    expect(numericLabItems(rows)).toEqual(["γ-GTP", "AST"]);
    expect(numericLabItems([])).toEqual([]);
  });

  it("builds a date-ascending numeric series for one item", () => {
    expect(labItemSeries(rows, "γ-GTP")).toEqual([
      { date: "2023-10-12", value: 261 },
      { date: "2024-11-14", value: 263 },
      { date: "2025-02-06", value: 334 },
      { date: "2026-08-20", value: 178 },
    ]);
    expect(labItemSeries(rows, "色調")).toEqual([]);
    expect(labItemSeries(rows, "missing")).toEqual([]);
  });

  it("returns the latest unit for an item", () => {
    expect(labItemUnit(rows, "γ-GTP")).toBe("IU/L");
    expect(labItemUnit(rows, "missing")).toBe("");
    expect(labItemUnit([{ item: "x" }], "x")).toBe("");
  });
});

describe("lab sort branch coverage", () => {
  it("sorts groups regardless of input order", () => {
    const shuffled = [
      { date: "2023-10-12", panel: "血液検査", item: "AST", value: 33, valueNumber: 33, unit: "IU/L" },
      { date: "2026-08-20", panel: "血液検査", item: "AST", value: 26, valueNumber: 26, unit: "IU/L" },
      { date: "2025-02-06", panel: "血液検査", item: "AST", value: 35, valueNumber: 35, unit: "IU/L" },
    ];
    expect(groupLabResults(shuffled).map((g) => g.date)).toEqual(["2026-08-20", "2025-02-06", "2023-10-12"]);
    expect(labItemSeries(shuffled, "AST").map((p) => p.value)).toEqual([33, 35, 26]);
  });
});

describe("featured lab items", () => {
  it("returns series for featured items with at least two points", () => {
    const featured = featuredLabSeries(rows);
    expect(featured.map((f) => f.item)).toEqual(["γ-GTP", "AST"]);
    expect(featured[0].unit).toBe("IU/L");
    expect(featured[0].points).toHaveLength(4);
  });

  it("returns an empty list when nothing matches", () => {
    expect(featuredLabSeries([])).toEqual([]);
  });
});
