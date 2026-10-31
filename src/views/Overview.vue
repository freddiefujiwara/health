<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import ShareSessionCard from "@/components/ShareSessionCard.vue";
import { formatDecimal, formatInteger, formatKg, formatPercentChange } from "@/domain/format";
import {
  average,
  firstOf,
  goalProgressPercent,
  goalReachDate,
  latestOf,
  predictWeightKg,
  projectionPoints,
  recentRows,
  remainingToGoal,
} from "@/domain/stats";

const { data, store } = useHealthData();

const body = computed(() => data.value?.bodyComposition ?? []);
const tanita = computed(() => body.value.filter((row) => row.measurementType === "TANITA"));
const latest = computed(() => latestOf(tanita.value));
const start = computed(() => firstOf(tanita.value));
const goals = computed(() => data.value?.goals ?? {});

const weightPoints = computed(() =>
  tanita.value.map((row) => ({ date: row.date, value: row.weightKg })),
);

const nutrition7 = computed(() => recentRows(data.value?.dailyNutrition ?? [], 7));
const steps7 = computed(() => recentRows(data.value?.steps ?? [], 7));

const cards = computed(() => {
  if (!latest.value) {
    return [];
  }
  const l = latest.value;
  const s = start.value;
  return [
    { label: `最新体重（${l.date}）`, value: formatKg(l.weightKg), sub: `開始時比 ${formatPercentChange(l.weightKg, s?.weightKg)}` },
    { label: "体脂肪率", value: `${formatDecimal(l.bodyFatPercent)} %`, sub: `開始時 ${formatDecimal(s?.bodyFatPercent)} %`, public: true },
    { label: "筋肉量", value: formatKg(l.muscleMassKg), sub: `開始時比 ${formatPercentChange(l.muscleMassKg, s?.muscleMassKg)}` },
    { label: "内臓脂肪レベル", value: formatInteger(l.visceralFatLevel), sub: `開始時 ${formatInteger(s?.visceralFatLevel)}`, public: true },
    { labelParts: ["中間目標 ", { mask: formatInteger(goals.value.interimGoalKg) }, " kgまで"], value: formatKg(remainingToGoal(l.weightKg, goals.value.interimGoalKg)), sub: `進捗 ${formatDecimal(goalProgressPercent(s?.weightKg, l.weightKg, goals.value.interimGoalKg), 0)} %`, public: true },
    { labelParts: ["最終目標 ", { mask: formatInteger(goals.value.finalGoalKg) }, " kgまで"], value: formatKg(remainingToGoal(l.weightKg, goals.value.finalGoalKg)), sub: `進捗 ${formatDecimal(goalProgressPercent(s?.weightKg, l.weightKg, goals.value.finalGoalKg), 0)} %` },
    { label: "直近7日 平均摂取", value: `${formatInteger(average(nutrition7.value.map((r) => r.intakeKcal)))} kcal`, sub: `目安 ${formatInteger(goals.value.intakeGuidelineKcal)} kcal`, public: true },
    { label: "直近7日 平均収支", value: `${formatInteger(average(nutrition7.value.map((r) => r.balanceKcal)))} kcal`, sub: "マイナスが減量方向", public: true },
    { label: "直近7日 平均歩数", value: `${formatInteger(average(steps7.value.map((r) => r.steps)))} 歩`, sub: "", public: true },
  ];
});

const finalProgress = computed(() =>
  goalProgressPercent(start.value?.weightKg, latest.value?.weightKg, goals.value.finalGoalKg),
);

const completedNutrition = computed(() =>
  (data.value?.dailyNutrition ?? []).filter((row) => row.completeness === "完了"),
);
const avgBalance30 = computed(() =>
  average(recentRows(completedNutrition.value, 30).map((row) => row.balanceKcal)),
);
const projection = computed(() =>
  latest.value ? projectionPoints(latest.value, avgBalance30.value, 90, 15) : [],
);
const predictionCards = computed(() => {
  if (!latest.value) {
    return [];
  }
  const l = latest.value;
  const interimDate = goalReachDate(l.date, l.weightKg, goals.value.interimGoalKg, avgBalance30.value);
  const finalDate = goalReachDate(l.date, l.weightKg, goals.value.finalGoalKg, avgBalance30.value);
  return [
    { label: "直近30日 平均収支（完了日のみ）", value: `${formatInteger(avgBalance30.value)} kcal/日`, public: true },
    { label: "30日後の予測体重", value: formatKg(predictWeightKg(l.weightKg, avgBalance30.value, 30)), public: false },
    { labelParts: ["中間目標 ", { mask: formatInteger(goals.value.interimGoalKg) }, " kg 到達予測"], value: interimDate ?? "現在の収支では未達", public: true },
    { labelParts: ["最終目標 ", { mask: formatInteger(goals.value.finalGoalKg) }, " kg 到達予測"], value: finalDate ?? "現在の収支では未達", public: true },
  ];
});

const plan = computed(() => data.value?.medicationPlan?.[0] ?? null);
const log = computed(() => [...(data.value?.medicationLog ?? [])].reverse());
</script>

<template>
  <div v-if="data">
    <div class="card-grid">
      <section v-for="card in cards" :key="card.label ?? card.labelParts.join('')" class="card">
        <h2><template v-if="card.labelParts"><template v-for="(part, i) in card.labelParts" :key="i"><span v-if="typeof part === 'object'" class="privacy-mask">{{ part.mask }}</span><template v-else>{{ part }}</template></template></template><template v-else>{{ card.label }}</template></h2>
        <p :class="card.public ? 'amount-value is-public' : 'amount-value'">{{ card.value }}</p>
        <p v-if="card.sub" class="meta">{{ card.sub }}</p>
      </section>
    </div>

    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">体重の推移</h2>
      <LineChart
        :points="weightPoints"
        :projection-points="projection"
        hide-axis-in-private
        unit="kg"
        :goal-value="goals.finalGoalKg"
        :goal-label-parts="['最終目標 ', { mask: formatInteger(goals.finalGoalKg) }, 'kg']"
      />
      <p class="meta" style="margin-top: 8px">
        最終目標までの進捗
        <span class="amount-value is-public">{{ formatDecimal(finalProgress, 0) }}%</span>
      </p>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${finalProgress ?? 0}%` }"></div>
      </div>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">体重予測（収支ベース）</h2>
      <div class="card-grid" style="margin-bottom: 0">
        <section v-for="card in predictionCards" :key="card.label ?? card.labelParts.join('')" class="card">
          <h2><template v-if="card.labelParts"><template v-for="(part, i) in card.labelParts" :key="i"><span v-if="typeof part === 'object'" class="privacy-mask">{{ part.mask }}</span><template v-else>{{ part }}</template></template></template><template v-else>{{ card.label }}</template></h2>
          <p :class="card.public ? 'amount-value is-public' : 'amount-value'">{{ card.value }}</p>
        </section>
      </div>
      <p class="meta" style="margin-top: 8px">
        直近30日（完了日）の平均収支が続くと仮定し、7,700 kcal ≒ 1 kg で換算した単純推計です。水分や筋肉量の変化は含みません。
      </p>
    </section>

    <section v-if="plan" class="table-wrap">
      <h2 class="section-title">投薬</h2>
      <p>
        {{ plan.name }}（{{ plan.generic_name }}）{{ plan.dose_mg }}mg / {{ plan.frequency }}（{{ plan.scheduled_weekday }}）
      </p>
      <p class="meta">
        開始：{{ plan.started_on }}（{{ plan.started_on_precision }}） / 期間：{{ plan.planned_course }} / 終了予定：{{ plan.planned_end }}
      </p>
      <table v-if="log.length" style="margin-top: 8px">
        <thead>
          <tr><th>日付</th><th>薬剤</th><th>用量</th><th>状態</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in log" :key="row.date">
            <td>{{ row.date }}</td>
            <td>{{ row.medication }}</td>
            <td>{{ row.dose_mg }} mg</td>
            <td>{{ row.status }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ShareSessionCard v-if="store.hasIdToken && !store.shareMode" />
  </div>
</template>
