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
    expect(empty.chatActivity).toEqual([]);
    expect(empty.chatActivityHours).toEqual([]);
    expect(empty.chatActivityDailyHours).toEqual([]);
    expect(empty.sleepEstimates).toEqual([]);
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
  });
});

describe("normalizeHealth work hours", () => {
  it("types work_hours rows and sorts them by date", () => {
    const result = normalizeHealth({
      work_hours: [
        { date: "2026-11-21", net_work_minutes: 570, status: "確定", first_arrive: "09:00", last_leave: "18:30", pair_count: 1 },
        { date: "2026-11-20", net_work_minutes: "", status: "未確定", first_arrive: "09:05", last_leave: "", pair_count: 0 },
      ],
    });
    expect(result.workHours.map((r) => r.date)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(result.workHours[1].netWorkMinutes).toBe(570);
    expect(result.workHours[0].netWorkMinutes).toBeNull();
    expect(result.workHours[0].status).toBe("未確定");
  });

  it("trims an ISO timestamp date to YYYY-MM-DD", () => {
    const result = normalizeHealth({
      work_hours: [
        { date: "2026-11-21T00:00:00+09:00", net_work_minutes: 570, status: "確定", first_arrive: "09:00", last_leave: "18:30", pair_count: 1 },
      ],
    });
    expect(result.workHours[0].date).toBe("2026-11-21");
  });

  it("reads a missing work_hours sheet as empty", () => {
    expect(normalizeHealth({}).workHours).toEqual([]);
  });
});

describe("normalizeHealth home segments", () => {
  it("types home_segments rows and sorts them by date then start minute", () => {
    const result = normalizeHealth({
      home_segments: [
        { date: "2026-11-21", start_minute: 536, end_minute: 772, state: "out", minutes: 236 },
        { date: "2026-11-21T00:00:00+09:00", start_minute: 0, end_minute: 536, state: "home", minutes: 536 },
        { date: "2026-11-20", start_minute: 0, end_minute: 1440, state: "home", minutes: 1440 },
        { start_minute: 10, end_minute: 20, state: "home", minutes: 10 },
      ],
    });
    expect(result.homeSegments.map((r) => `${r.date} ${r.startMinute}`)).toEqual([
      "2026-11-20 0",
      "2026-11-21 0",
      "2026-11-21 536",
    ]);
    expect(result.homeSegments[2].state).toBe("out");
  });

  it("reads a missing home_segments sheet as empty", () => {
    expect(normalizeHealth({}).homeSegments).toEqual([]);
  });
});

describe("normalizeHealth work segments", () => {
  it("types work_segments rows like home segments", () => {
    const result = normalizeHealth({
      work_segments: [
        { date: "2026-11-25", start_minute: 387, end_minute: 1005, state: "work", minutes: 618 },
      ],
    });
    expect(result.workSegments).toEqual([
      { date: "2026-11-25", startMinute: 387, endMinute: 1005, state: "work", minutes: 618 },
    ]);
  });

  it("reads a missing work_segments sheet as empty", () => {
    expect(normalizeHealth({}).workSegments).toEqual([]);
  });
});

describe("normalizeHealth home hours", () => {
  it("types home_hours rows and sorts them by date", () => {
    const result = normalizeHealth({
      home_hours: [
        { date: "2026-11-21", home_minutes: 565, status: "確定", first_leave: "04:55", last_arrive: "19:30", outing_count: 1 },
        { date: "2026-11-20", home_minutes: "", status: "未確定", first_leave: "", last_arrive: "", outing_count: 0 },
      ],
    });
    expect(result.homeHours.map((r) => r.date)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(result.homeHours[1].homeMinutes).toBe(565);
    expect(result.homeHours[0].homeMinutes).toBeNull();
    expect(result.homeHours[0].status).toBe("未確定");
  });

  it("trims an ISO timestamp date to YYYY-MM-DD", () => {
    const result = normalizeHealth({
      home_hours: [
        { date: "2026-11-21T00:00:00+09:00", home_minutes: 565, status: "確定", first_leave: "04:55", last_arrive: "19:30", outing_count: 1 },
      ],
    });
    expect(result.homeHours[0].date).toBe("2026-11-21");
  });

  it("reads a missing home_hours sheet as empty", () => {
    expect(normalizeHealth({}).homeHours).toEqual([]);
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

  it("normalizes chat activity, padding times and sorting by date", () => {
    const result = normalizeHealth({
      chat_activity: [
        { date: "2026-11-12", user_message_count: 227, engaged_minutes_est: 870, session_count: 7, first_message_at: "4:14", last_message_at: "23:11", late_night_message_count: 3, notes: "利用開始日" },
        { date: "2026-11-11", user_message_count: "280", engaged_minutes_est: "abc", session_count: 6, first_message_at: "01:37", last_message_at: "", late_night_message_count: 35 },
        { date: "2026-11-10", user_message_count: 5 },
        { user_message_count: 10 },
        null,
      ],
    });
    expect(result.chatActivity).toHaveLength(3);
    expect(result.chatActivity[0].date).toBe("2026-11-10");
    expect(result.chatActivity[0].firstMessageAt).toBe("");
    expect(result.chatActivity[0].engagedMinutesEst).toBeNull();
    expect(result.chatActivity[1].userMessageCount).toBe(280);
    expect(result.chatActivity[1].engagedMinutesEst).toBeNull();
    expect(result.chatActivity[1].firstMessageAt).toBe("01:37");
    expect(result.chatActivity[1].lastMessageAt).toBe("");
    expect(result.chatActivity[1].notes).toBe("");
    expect(result.chatActivity[2].firstMessageAt).toBe("04:14");
    expect(result.chatActivity[2].notes).toBe("利用開始日");
  });

  it("normalizes chat activity hours sorted by hour", () => {
    const result = normalizeHealth({
      chat_activity_hours: [
        { hour: 13, user_message_count: 256, engaged_minutes_est: 884 },
        { hour: "5", user_message_count: "426", engaged_minutes_est: "742" },
        { hour: 0, user_message_count: 28 },
        { user_message_count: 10 },
        { hour: "", user_message_count: 10 },
        { hour: null, user_message_count: 10 },
        null,
      ],
    });
    expect(result.chatActivityHours.map((r) => r.hour)).toEqual([0, 5, 13]);
    expect(result.chatActivityHours[1].userMessageCount).toBe(426);
    expect(result.chatActivityHours[0].engagedMinutesEst).toBeNull();
  });

  it("normalizes chat activity daily hours sorted by date and hour", () => {
    const result = normalizeHealth({
      chat_activity_daily_hours: [
        { date: "2026-11-12", hour: 5, user_message_count: 28, engaged_minutes_est: 59 },
        { date: "2026-11-11", hour: 21, user_message_count: 26 },
        { date: "2026-11-12", hour: "4", user_message_count: "14", engaged_minutes_est: "63" },
        { date: "", hour: 3, user_message_count: 10 },
        { hour: 3, user_message_count: 10 },
        { date: "2026-11-12", hour: "", user_message_count: 10 },
        null,
      ],
    });
    expect(result.chatActivityDailyHours.map((r) => `${r.date} ${r.hour}`)).toEqual([
      "2026-11-11 21",
      "2026-11-12 4",
      "2026-11-12 5",
    ]);
    expect(result.chatActivityDailyHours[0].engagedMinutesEst).toBeNull();
  });

  it("normalizes server late-night totals, dropping unusable rows", () => {
    const result = normalizeHealth({
      late_night_by_date: [
        { date: "2026-11-20", late_night_minutes: 45 },
        { date: "2026-08-23T00:00:00+09:00", late_night_minutes: "30" },
        { date: "2026-11-21", late_night_minutes: "abc" },
        { late_night_minutes: 10 },
        null,
      ],
    });
    expect(result.lateNightByDate).toEqual([
      { date: "2026-08-23", minutes: 30 },
      { date: "2026-11-20", minutes: 45 },
    ]);
    expect(normalizeHealth({}).lateNightByDate).toEqual([]);
  });

  it("normalizes sleep estimates sorted by date", () => {
    const result = normalizeHealth({
      sleep_estimates: [
        { date: "2026-11-12", sleep_start_est: "22:29", sleep_end_est: "04:14", duration_minutes_est: 345 },
        { date: "2026-11-11", sleep_start_est: "22:50", sleep_end_est: "01:37", duration_minutes_est: "166" },
        { date: "2026-11-10", duration_minutes_est: 228 },
        { date: "2026-11-10", sleep_start_est: "23:00", sleep_end_est: "02:00", duration_minutes_est: 180 },
        { date: "", sleep_start_est: "22:00", duration_minutes_est: 100 },
        null,
      ],
    });
    expect(result.sleepEstimates.map((r) => r.date)).toEqual(["2026-11-10", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(result.sleepEstimates[0].sleepStartEst).toBeNull();
    expect(result.sleepEstimates[0].sleepEndEst).toBeNull();
    expect(result.sleepEstimates[2].durationMinutesEst).toBe(166);
    expect(result.sleepEstimates[3].sleepStartEst).toBe("22:29");
  });
});
