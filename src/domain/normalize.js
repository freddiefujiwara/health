/**
 * Normalize the health-gas API payload (rows keyed by sheet name)
 * into sorted, typed structures the views can consume directly.
 */

/**
 * Numeric cells: only numbers and numeric strings parse. Booleans,
 * arrays, objects and blank strings read as missing — Number() would
 * silently coerce them (true -> 1, [] -> 0, [65] -> 65) or, for an
 * object whose toString is not a function, throw outright.
 */
function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Text cells: strings pass through and numbers stringify; anything
 * else (null, booleans, arrays, objects) reads as "". String() is not
 * used on unknown values — it throws for an object whose toString is
 * not a function.
 */
function toText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

/** A sheet key holding anything but an array reads as no rows. */
function asRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function byDateAsc(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function normalizeBodyComposition(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date),
      measurementType: toText(row.measurement_type),
      weightKg: toNumber(row.weight_kg),
      bmi: toNumber(row.bmi),
      bodyFatPercent: toNumber(row.body_fat_percent),
      fatMassKg: toNumber(row.fat_mass_kg),
      muscleMassKg: toNumber(row.muscle_mass_kg),
      leanMassKg: toNumber(row.lean_mass_kg),
      bodyWaterKg: toNumber(row.body_water_kg),
      proteinMassKg: toNumber(row.protein_mass_kg),
      boneMassKg: toNumber(row.estimated_bone_mass_kg),
      bmrKcal: toNumber(row.basal_metabolic_rate_kcal),
      visceralFatLevel: toNumber(row.visceral_fat_level),
      smi: toNumber(row.smi),
      legMuscleScore: toNumber(row.leg_muscle_score),
    }))
    .sort(byDateAsc);
}

function normalizeDailyNutrition(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date),
      intakeKcal: toNumber(row.intake_kcal),
      expenditureKcal: toNumber(row.expenditure_kcal),
      balanceKcal: toNumber(row.balance_kcal),
      proteinG: toNumber(row.protein_g),
      fatG: toNumber(row.fat_g),
      carbohydratesG: toNumber(row.carbohydrates_g),
      saltG: toNumber(row.salt_g),
      completeness: toText(row.completeness),
    }))
    .sort(byDateAsc);
}

function normalizeSteps(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date),
      steps: toNumber(row.steps),
      distanceM: toNumber(row.distance_walking_running_m),
      flightsClimbed: toNumber(row.flights_climbed),
      completeness: toText(row.completeness),
    }))
    .sort(byDateAsc);
}

function normalizeSegments(rows) {
  return rows
    .filter((row) => row && row.date && row.segment)
    .map((row) => ({
      date: toText(row.date),
      segment: toText(row.segment),
      muscleMassKg: toNumber(row.muscle_mass_kg),
      fatPercent: toNumber(row.fat_percent),
      fatMassKg: toNumber(row.fat_mass_kg),
    }))
    .sort(byDateAsc);
}

function normalizePeriodSummaries(rows) {
  return rows
    .filter((row) => row && row.start_date)
    .map((row) => ({
      startDate: toText(row.start_date),
      endDate: toText(row.end_date),
      days: toNumber(row.days),
      averageIntakeKcal: toNumber(row.average_intake_kcal),
      averageExpenditureKcal: toNumber(row.average_expenditure_kcal),
      totalBalanceKcal: toNumber(row.total_balance_kcal),
      averageBalanceKcal: toNumber(row.average_balance_kcal),
    }))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

function normalizeLabResults(rows) {
  return rows
    .filter((row) => row && row.date && row.item)
    .map((row) => ({
      date: toText(row.date),
      panel: toText(row.panel),
      category: toText(row.category),
      item: toText(row.item),
      value: toText(row.value),
      valueNumber: toNumber(row.value),
      flag: toText(row.flag),
      unit: toText(row.unit),
      reference: toText(row.reference),
      source: toText(row.source),
      notes: toText(row.notes),
    }))
    .sort(byDateAsc);
}

/** "4:14" / "13:04" -> "04:14" / "13:04"; anything else -> "". */
function normalizeTimeText(value) {
  const match = toText(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return "";
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeChatActivity(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date).slice(0, 10),
      userMessageCount: toNumber(row.user_message_count),
      engagedMinutesEst: toNumber(row.engaged_minutes_est),
      sessionCount: toNumber(row.session_count),
      firstMessageAt: normalizeTimeText(row.first_message_at),
      lastMessageAt: normalizeTimeText(row.last_message_at),
      lateNightMessageCount: toNumber(row.late_night_message_count),
      notes: toText(row.notes),
    }))
    .sort(byDateAsc);
}

function normalizeChatActivityHours(rows) {
  return rows
    .filter((row) => row && row.hour !== null && row.hour !== undefined && row.hour !== "")
    .map((row) => ({
      hour: toNumber(row.hour),
      userMessageCount: toNumber(row.user_message_count),
      engagedMinutesEst: toNumber(row.engaged_minutes_est),
    }))
    .sort((a, b) => a.hour - b.hour);
}

function normalizeChatActivityDailyHours(rows) {
  return rows
    .filter((row) => row && row.date && row.hour !== null && row.hour !== undefined && row.hour !== "")
    .map((row) => ({
      date: toText(row.date),
      hour: toNumber(row.hour),
      userMessageCount: toNumber(row.user_message_count),
      engagedMinutesEst: toNumber(row.engaged_minutes_est),
    }))
    .sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1));
}

function normalizeSleepEstimates(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date),
      sleepStartEst: row.sleep_start_est ?? null,
      sleepEndEst: row.sleep_end_est ?? null,
      durationMinutesEst: toNumber(row.duration_minutes_est),
    }))
    .sort(byDateAsc);
}

function normalizeWorkHours(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: toText(row.date),
      netWorkMinutes: toNumber(row.net_work_minutes),
      status: toText(row.status),
      firstArrive: toText(row.first_arrive),
      lastLeave: toText(row.last_leave),
      pairCount: toNumber(row.pair_count),
    }))
    .sort(byDateAsc);
}

function normalizeGoals(rows) {
  const goals = {
    startWeightKg: null,
    startDate: "",
    latestWeightKg: null,
    latestDate: "",
    interimGoalKg: null,
    finalGoalKg: null,
    targetDate: "",
    intakeGuidelineKcal: null,
    expenditureGuidelineKcal: null,
  };
  for (const row of rows) {
    if (!row || !row.item) {
      continue;
    }
    switch (row.item) {
      case "開始時体重":
        goals.startWeightKg = toNumber(row.value);
        goals.startDate = toText(row.unit_or_date).replace("kg / ", "");
        break;
      case "最新体重":
        goals.latestWeightKg = toNumber(row.value);
        goals.latestDate = toText(row.unit_or_date).replace("kg / ", "");
        break;
      case "中間目標":
        goals.interimGoalKg = toNumber(row.value);
        break;
      case "最終目標":
        goals.finalGoalKg = toNumber(row.value);
        break;
      case "目標日":
        goals.targetDate = toText(row.value);
        break;
      case "摂取目安":
        goals.intakeGuidelineKcal = toNumber(row.value);
        break;
      case "消費目安":
        goals.expenditureGuidelineKcal = toNumber(row.value);
        break;
      default:
        break;
    }
  }
  return goals;
}

export function normalizeHealth(payload) {
  const source = payload ?? {};
  return {
    bodyComposition: normalizeBodyComposition(asRows(source.body_composition)),
    dailyNutrition: normalizeDailyNutrition(asRows(source.daily_nutrition)),
    steps: normalizeSteps(asRows(source.steps)),
    segments: normalizeSegments(asRows(source.body_segments)),
    periodSummaries: normalizePeriodSummaries(asRows(source.period_summaries)),
    labResults: normalizeLabResults(asRows(source.lab_results)),
    chatActivity: normalizeChatActivity(asRows(source.chat_activity)),
    chatActivityHours: normalizeChatActivityHours(asRows(source.chat_activity_hours)),
    chatActivityDailyHours: normalizeChatActivityDailyHours(asRows(source.chat_activity_daily_hours)),
    sleepEstimates: normalizeSleepEstimates(asRows(source.sleep_estimates)),
    workHours: normalizeWorkHours(asRows(source.work_hours)),
    goals: normalizeGoals(asRows(source.goals_settings)),
  };
}
