/**
 * Normalize the health-gas API payload (rows keyed by sheet name)
 * into sorted, typed structures the views can consume directly.
 */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function byDateAsc(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function normalizeBodyComposition(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: row.date,
      measurementType: row.measurement_type ?? "",
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
      date: row.date,
      intakeKcal: toNumber(row.intake_kcal),
      expenditureKcal: toNumber(row.expenditure_kcal),
      balanceKcal: toNumber(row.balance_kcal),
      proteinG: toNumber(row.protein_g),
      fatG: toNumber(row.fat_g),
      carbohydratesG: toNumber(row.carbohydrates_g),
      saltG: toNumber(row.salt_g),
      completeness: row.completeness ?? "",
    }))
    .sort(byDateAsc);
}

function normalizeSteps(rows) {
  return rows
    .filter((row) => row && row.date)
    .map((row) => ({
      date: row.date,
      steps: toNumber(row.steps),
      distanceM: toNumber(row.distance_walking_running_m),
      flightsClimbed: toNumber(row.flights_climbed),
      completeness: row.completeness ?? "",
    }))
    .sort(byDateAsc);
}

function normalizeSegments(rows) {
  return rows
    .filter((row) => row && row.date && row.segment)
    .map((row) => ({
      date: row.date,
      segment: row.segment,
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
      startDate: row.start_date,
      endDate: row.end_date ?? "",
      days: toNumber(row.days),
      averageIntakeKcal: toNumber(row.average_intake_kcal),
      totalBalanceKcal: toNumber(row.total_balance_kcal),
      averageBalanceKcal: toNumber(row.average_balance_kcal),
    }))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
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
        goals.startDate = String(row.unit_or_date ?? "").replace("kg / ", "");
        break;
      case "最新体重":
        goals.latestWeightKg = toNumber(row.value);
        goals.latestDate = String(row.unit_or_date ?? "").replace("kg / ", "");
        break;
      case "中間目標":
        goals.interimGoalKg = toNumber(row.value);
        break;
      case "最終目標":
        goals.finalGoalKg = toNumber(row.value);
        break;
      case "目標日":
        goals.targetDate = String(row.value ?? "");
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
    bodyComposition: normalizeBodyComposition(source.body_composition ?? []),
    dailyNutrition: normalizeDailyNutrition(source.daily_nutrition ?? []),
    steps: normalizeSteps(source.steps ?? []),
    segments: normalizeSegments(source.body_segments ?? []),
    periodSummaries: normalizePeriodSummaries(source.period_summaries ?? []),
    medicationPlan: source.medication_plan ?? [],
    medicationLog: source.medication_log ?? [],
    goals: normalizeGoals(source.goals_settings ?? []),
  };
}
