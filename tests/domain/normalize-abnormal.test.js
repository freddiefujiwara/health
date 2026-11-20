import { describe, expect, it } from "vitest";
import { normalizeHealth } from "../../src/domain/normalize";

// Abnormal-case tests: deformed health-gas payloads. The shaping layer
// is the boundary between the /exec JSON and every view, so a deformed
// sheet or cell must degrade to empty / null / text — never throw and
// never leak a non-string or non-finite value into the typed output.
// A value whose `toString` is not a function is a legitimate JSON-domain
// case: JSON.parse('{"toString":[]}') produces one, and Number() /
// String() / `<` on it raise TypeError.
const badToString = { toString: [] };

const SHEET_KEYS = [
  "body_composition",
  "daily_nutrition",
  "steps",
  "body_segments",
  "period_summaries",
  "lab_results",
  "chat_activity",
  "chat_activity_hours",
  "chat_activity_daily_hours",
  "sleep_estimates",
  "goals_settings",
];

describe("normalizeHealth with deformed sheet shapes", () => {
  it("reads a non-array sheet value as empty instead of throwing", () => {
    for (const key of SHEET_KEYS) {
      for (const junk of ["text", 42, { rows: [] }, true]) {
        const result = normalizeHealth({ [key]: junk });
        expect(Array.isArray(result.bodyComposition)).toBe(true);
        expect(result.goals.startWeightKg).toBeNull();
      }
    }
    expect(normalizeHealth({ body_composition: "text" }).bodyComposition).toEqual([]);
    expect(normalizeHealth({ daily_nutrition: {} }).dailyNutrition).toEqual([]);
    expect(normalizeHealth({ steps: 42 }).steps).toEqual([]);
    expect(normalizeHealth({ goals_settings: {} }).goals.targetDate).toBe("");
  });

  it("keeps healthy sheets when a sibling sheet is deformed", () => {
    const result = normalizeHealth({
      body_composition: "broken",
      steps: [{ date: "2026-08-23", steps: 6148 }],
    });
    expect(result.bodyComposition).toEqual([]);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].steps).toBe(6148);
  });

  it("drops non-object rows inside a sheet", () => {
    const result = normalizeHealth({
      body_composition: ["junk", 42, [1, 2], null, undefined, { date: "2026-01-01", weight_kg: 90 }],
    });
    expect(result.bodyComposition).toHaveLength(1);
    expect(result.bodyComposition[0].weightKg).toBe(90);
  });

  it("treats a goals sheet given as a bare string as no settings", () => {
    const result = normalizeHealth({ goals_settings: "開始時体重" });
    expect(result.goals.startWeightKg).toBeNull();
    expect(result.goals.targetDate).toBe("");
  });
});

describe("normalizeHealth numeric cell coercion", () => {
  const weightOf = (value) =>
    normalizeHealth({ body_composition: [{ date: "2026-01-01", weight_kg: value }] })
      .bodyComposition[0].weightKg;

  it("parses numbers and numeric strings only", () => {
    expect(weightOf(91.5)).toBe(91.5);
    expect(weightOf("91.5")).toBe(91.5);
    expect(weightOf("")).toBeNull();
    expect(weightOf("abc")).toBeNull();
    expect(weightOf(null)).toBeNull();
    expect(weightOf(undefined)).toBeNull();
  });

  it("reads booleans, arrays, objects and blank strings as missing", () => {
    expect(weightOf(true)).toBeNull();
    expect(weightOf(false)).toBeNull();
    expect(weightOf([])).toBeNull();
    expect(weightOf([65])).toBeNull();
    expect(weightOf({})).toBeNull();
    expect(weightOf("  ")).toBeNull();
    expect(weightOf(badToString)).toBeNull();
  });

  it("reads non-finite numbers as missing", () => {
    expect(weightOf(Number.NaN)).toBeNull();
    expect(weightOf(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("applies the same coercion on other sheets", () => {
    const result = normalizeHealth({
      steps: [{ date: "2026-01-01", steps: true, flights_climbed: [3] }],
      lab_results: [{ date: "2026-01-01", item: "pH", value: badToString }],
      chat_activity_hours: [{ hour: badToString, user_message_count: 10 }],
      chat_activity: [{ date: "2026-01-01", first_message_at: badToString, last_message_at: "23:11" }],
    });
    expect(result.steps[0].steps).toBeNull();
    expect(result.steps[0].flightsClimbed).toBeNull();
    expect(result.labResults[0].valueNumber).toBeNull();
    expect(result.chatActivityHours[0].hour).toBeNull();
    expect(result.chatActivityHours[0].userMessageCount).toBe(10);
    expect(result.chatActivity[0].firstMessageAt).toBe("");
    expect(result.chatActivity[0].lastMessageAt).toBe("23:11");
  });
});

describe("normalizeHealth text and date fields", () => {
  it("always emits string dates, coercing numeric dates", () => {
    const result = normalizeHealth({
      body_composition: [{ date: 20261017, weight_kg: 90 }],
      period_summaries: [{ start_date: 20260901, end_date: 20260907 }],
    });
    expect(result.bodyComposition[0].date).toBe("20261017");
    expect(result.periodSummaries[0].startDate).toBe("20260901");
    expect(result.periodSummaries[0].endDate).toBe("20260907");
  });

  it("survives values whose toString is not a function in date fields", () => {
    const result = normalizeHealth({
      body_composition: [
        { date: badToString, weight_kg: 90 },
        { date: badToString, weight_kg: 80 },
        { date: "2026-01-01", weight_kg: 70 },
      ],
      chat_activity: [{ date: badToString, user_message_count: 3 }],
    });
    expect(result.bodyComposition).toHaveLength(3);
    for (const row of result.bodyComposition) {
      expect(typeof row.date).toBe("string");
    }
    expect(result.chatActivity).toHaveLength(1);
    expect(typeof result.chatActivity[0].date).toBe("string");
  });

  it("survives a non-stringifiable goal date / unit", () => {
    const result = normalizeHealth({
      goals_settings: [
        { item: "開始時体重", value: 99.7, unit_or_date: badToString },
        { item: "目標日", value: badToString },
      ],
    });
    expect(result.goals.startWeightKg).toBe(99.7);
    expect(typeof result.goals.startDate).toBe("string");
    expect(typeof result.goals.targetDate).toBe("string");
  });

  it("emits strings for label fields even when cells are non-scalar", () => {
    const result = normalizeHealth({
      body_composition: [{ date: "2026-01-01", measurement_type: badToString, weight_kg: 90 }],
      lab_results: [{ date: "2026-01-01", item: badToString, value: 6, unit: ["mg"] }],
      body_segments: [{ date: "2026-01-01", segment: { name: "trunk" }, muscle_mass_kg: 30 }],
    });
    expect(typeof result.bodyComposition[0].measurementType).toBe("string");
    expect(typeof result.labResults[0].item).toBe("string");
    expect(typeof result.labResults[0].unit).toBe("string");
    expect(typeof result.labResults[0].value).toBe("string");
    expect(typeof result.segments[0].segment).toBe("string");
  });
});
