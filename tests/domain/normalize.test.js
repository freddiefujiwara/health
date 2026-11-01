import { describe, expect, it } from "vitest";
import { normalizeHealth } from "../../src/domain/normalize";

describe("normalizeHealth", () => {
  it("returns empty structures for null / empty payloads", () => {
    const empty = normalizeHealth(null);
    expect(empty.bodyComposition).toEqual([]);
    expect(empty.dailyNutrition).toEqual([]);
    expect(empty.steps).toEqual([]);
    expect(empty.segments).toEqual([]);
    expect(empty.periodSummaries).toEqual([]);
    expect(empty.medicationPlan).toEqual([]);
    expect(empty.medicationLog).toEqual([]);
    expect(empty.goals.startWeightKg).toBeNull();
    expect(normalizeHealth({}).dailyNutrition).toEqual([]);
    expect(normalizeHealth(undefined).steps).toEqual([]);
  });

  it("normalizes body composition, converting numbers and sorting by date", () => {
    const result = normalizeHealth({
      body_composition: [
        { date: "2026-10-17", measurement_type: "TANITA", weight_kg: "91.5", bmi: 32.4 },
        { date: "2026-07-25", measurement_type: "TANITA", weight_kg: 99.7, bmi: "abc" },
        { measurement_type: "TANITA", weight_kg: 1 },
        { date: "2026-07-25", weight_kg: "" },
      ],
    });
    expect(result.bodyComposition).toHaveLength(3);
    expect(result.bodyComposition[0].date).toBe("2026-07-25");
    expect(result.bodyComposition[0].bmi).toBeNull();
    expect(result.bodyComposition[1].weightKg).toBeNull();
    expect(result.bodyComposition[2].weightKg).toBe(91.5);
    expect(result.bodyComposition[2].measurementType).toBe("TANITA");
    expect(result.bodyComposition[0].measurementType).toBe("TANITA");
    expect(result.bodyComposition[1].measurementType).toBe("");
  });

  it("normalizes nutrition, steps and segments", () => {
    const result = normalizeHealth({
      daily_nutrition: [
        { date: "2026-08-24", intake_kcal: 2000, balance_kcal: -500 },
        { date: "2026-08-23", intake_kcal: 1847 },
        null,
      ],
      steps: [
        { date: "2026-08-23", steps: 6148, distance_walking_running_m: 4417.5, flights_climbed: 3, completeness: "完了" },
        { steps: 10 },
      ],
      body_segments: [
        { date: "2026-07-25", segment: "trunk", muscle_mass_kg: 31.9 },
        { date: "2026-07-25", muscle_mass_kg: 1 },
      ],
    });
    expect(result.dailyNutrition.map((r) => r.date)).toEqual(["2026-08-23", "2026-08-24"]);
    expect(result.dailyNutrition[0].proteinG).toBeNull();
    expect(result.dailyNutrition[0].completeness).toBe("");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].steps).toBe(6148);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].segment).toBe("trunk");
  });

  it("normalizes period summaries sorted by start date", () => {
    const result = normalizeHealth({
      period_summaries: [
        { start_date: "2026-09-08", end_date: "2026-09-14", average_intake_kcal: 1956 },
        { start_date: "2026-09-01", average_intake_kcal: 2119 },
        { end_date: "2026-09-14" },
      ],
    });
    expect(result.periodSummaries.map((r) => r.startDate)).toEqual(["2026-09-01", "2026-09-08"]);
    expect(result.periodSummaries[0].endDate).toBe("");
    expect(result.periodSummaries[0].days).toBeNull();
  });

  it("covers remaining default branches", () => {
    const result = normalizeHealth({
      steps: [{ date: "2026-08-23", steps: 100 }],
      period_summaries: [
        { start_date: "2026-09-01", end_date: "2026-09-07" },
        { start_date: "2026-09-01", end_date: "2026-09-07" },
      ],
      goals_settings: [
        { item: "開始時体重", value: 99.7 },
        { item: "最新体重", value: 91.5, unit_or_date: "kg / 2026-10-17" },
        { item: "目標日" },
      ],
    });
    expect(result.steps[0].completeness).toBe("");
    expect(result.periodSummaries).toHaveLength(2);
    expect(result.goals.startDate).toBe("");
    expect(result.goals.latestDate).toBe("2026-10-17");
    expect(result.goals.targetDate).toBe("");
  });

  it("maps goal settings by item name and ignores unknown rows", () => {
    const result = normalizeHealth({
      goals_settings: [
        { item: "開始時体重", value: 99.7, unit_or_date: "kg / 2026-07-25" },
        { item: "最新体重", value: "91.5" },
        { item: "中間目標", value: 90 },
        { item: "最終目標", value: 80 },
        { item: "目標日", value: "2027-12-31" },
        { item: "摂取目安", value: 1990 },
        { item: "消費目安", value: 3031 },
        { item: "公開可否", value: "不可" },
        { value: 1 },
        null,
      ],
      medication_plan: [{ name: "マンジャロ" }],
      medication_log: [{ date: "2026-10-24" }],
    });
    expect(result.goals).toEqual({
      startWeightKg: 99.7,
      startDate: "2026-07-25",
      latestWeightKg: 91.5,
      latestDate: "",
      interimGoalKg: 90,
      finalGoalKg: 80,
      targetDate: "2027-12-31",
      intakeGuidelineKcal: 1990,
      expenditureGuidelineKcal: 3031,
    });
    expect(result.medicationPlan).toHaveLength(1);
    expect(result.medicationLog).toHaveLength(1);
  });
});

describe("normalizeHealth lab results", () => {
  it("normalizes lab results with numeric conversion", () => {
    const result = normalizeHealth({
      lab_results: [
        { date: "2026-08-20", panel: "血液検査", category: "肝機能", item: "γ-GTP", value: "178", flag: "H", unit: "IU/L", reference: "13-64", source: "検査結果報告書（皮膚科）", notes: "" },
        { date: "2026-09-17", panel: "尿検査", category: "尿定性", item: "色調", value: "淡黄色" },
        { date: "2026-09-17", item: "pH", value: 6.0 },
        { date: "2026-09-17", item: "混濁", value: null },
        { panel: "血液検査", item: "no-date" },
        { date: "2026-08-20", panel: "血液検査" },
        null,
      ],
    });
    expect(result.labResults).toHaveLength(4);
    expect(result.labResults[2].panel).toBe("");
    expect(result.labResults[2].category).toBe("");
    expect(result.labResults[3].value).toBe("");
    expect(result.labResults[0].valueNumber).toBe(178);
    expect(result.labResults[0].flag).toBe("H");
    expect(result.labResults[1].valueNumber).toBeNull();
    expect(result.labResults[1].category).toBe("尿定性");
    expect(result.labResults[1].unit).toBe("");
  });

  it("defaults labResults to an empty array", () => {
    expect(normalizeHealth({}).labResults).toEqual([]);
  });
});
