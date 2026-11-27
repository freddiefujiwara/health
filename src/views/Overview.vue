<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import ShareSessionCard from "@/components/ShareSessionCard.vue";
import { formatDecimal, formatDurationMinutes, formatInteger, formatKg, formatPercentChange } from "@/domain/format";
import {
  average,
  empiricalKcalPerKg,
  firstOf,
  goalProgressPercent,
  goalReachDate,
  KCAL_PER_KG,
  latestOf,
  predictWeightKg,
  weeklyBalanceProjection,
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

const cpapReports = computed(() => data.value?.cpapReports ?? []);
const latestCpap = computed(() => cpapReports.value[cpapReports.value.length - 1] ?? null);
const cpapHistory = computed(() => [...cpapReports.value].reverse());
const cpapCards = computed(() => {
  if (!latestCpap.value) {
    return [];
  }
  const r = latestCpap.value;
  return [
    { label: "AHI", value: `${formatDecimal(r.ahi)} 回/時間`, sub: `無呼吸 ${formatDecimal(r.ai)} ・ 低呼吸 ${formatDecimal(r.hi)}`, public: true },
    { label: "平均使用時間", value: formatDurationMinutes(r.avgUsageMin), sub: `全日平均 ${formatDurationMinutes(r.avgUsageAllDaysMin)}`, public: true },
    { label: "4時間以上使った日", value: `${formatInteger(r.daysOver4h)} / ${formatInteger(r.daysInPeriod)} 日`, sub: `使用 ${formatInteger(r.usageDays)} 日 ・ 未使用 ${formatInteger(r.unusedDays)} 日`, public: true },
    { label: "リーク中央値", value: `${formatDecimal(r.leakMedianLMin)} L/min`, sub: `圧力中央値 ${formatDecimal(r.pressureMedianCmh2o)} cmH2O`, public: true },
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
const empirical = computed(() =>
  empiricalKcalPerKg(tanita.value, data.value?.dailyNutrition ?? []),
);
const kcalPerKg = computed(() => empirical.value?.kcalPerKg ?? KCAL_PER_KG);
const weeklyProjection = computed(() =>
  weeklyBalanceProjection(
    latest.value,
    data.value?.dailyNutrition ?? [],
    avgBalance30.value,
    kcalPerKg.value,
  ),
);
const predictionCards = computed(() => {
  if (!latest.value) {
    return [];
  }
  const l = latest.value;
  const interimDate = goalReachDate(l.date, l.weightKg, goals.value.interimGoalKg, avgBalance30.value, kcalPerKg.value);
  const finalDate = goalReachDate(l.date, l.weightKg, goals.value.finalGoalKg, avgBalance30.value, kcalPerKg.value);
  return [
    { label: "直近30日 平均収支（完了日のみ）", value: `${formatInteger(avgBalance30.value)} kcal/日`, public: true },
    {
      label: "実測換算（体重 1 kg あたり）",
      value: empirical.value ? `${formatInteger(empirical.value.kcalPerKg)} kcal` : "算出に必要なデータ不足",
      public: true,
    },
    { label: "30日後の予測体重", value: formatKg(predictWeightKg(l.weightKg, avgBalance30.value, 30, kcalPerKg.value)), public: false },
    { labelParts: ["中間目標 ", { mask: formatInteger(goals.value.interimGoalKg) }, " kg 到達予測"], value: interimDate ?? "現在の収支では未達", public: true },
    { labelParts: ["最終目標 ", { mask: formatInteger(goals.value.finalGoalKg) }, " kg 到達予測"], value: finalDate ?? "現在の収支では未達", public: true },
  ];
});

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
        :model-points="weeklyProjection.dataPoints"
        :projection-points="weeklyProjection.forecastPoints"
        hide-axis-in-private
        unit="kg"
        :goal-value="goals.finalGoalKg"
        :goal-label-parts="['最終目標 ', { mask: formatInteger(goals.finalGoalKg) }, 'kg']"
      />
      <p v-if="weeklyProjection.dataPoints.length > 1" class="meta" style="margin-top: 8px">
        緑の点線は、最新の実測を起点に、日々のカロリー収支の実績を1週間ごとに積み上げた予測体重です（実測換算で計算）。グレーの点線は、収支データがない期間を直近30日（完了日）の平均収支が続くと仮定して伸ばした予測です。
      </p>
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
      <p v-if="empirical" class="meta" style="margin-top: 8px">
        直近30日（完了日）の平均収支が続くと仮定し、実測の換算（1 kg ≒ {{ formatInteger(empirical.kcalPerKg) }} kcal）で推計した単純推計です。換算値は {{ empirical.fromDate }}〜{{ empirical.toDate }} の収支累計 {{ formatInteger(empirical.totalBalanceKcal) }} kcal と体重変化から算出しています。水分や筋肉量の変化は含みません。
      </p>
      <p v-else class="meta" style="margin-top: 8px">
        直近30日（完了日）の平均収支が続くと仮定し、7,700 kcal ≒ 1 kg で換算した単純推計です。水分や筋肉量の変化は含みません。
      </p>
    </section>

    <section v-if="latestCpap" class="table-wrap">
      <h2 class="section-title">CPAP（睡眠時無呼吸）</h2>
      <div class="card-grid" style="margin-bottom: 0">
        <section v-for="card in cpapCards" :key="card.label" class="card">
          <h2>{{ card.label }}</h2>
          <p :class="card.public ? 'amount-value is-public' : 'amount-value'">{{ card.value }}</p>
          <p v-if="card.sub" class="meta">{{ card.sub }}</p>
        </section>
      </div>
      <p class="meta" style="margin-top: 8px">
        対象期間 {{ latestCpap.periodStart }} 〜 {{ latestCpap.periodEnd }} の治療レポート（{{ latestCpap.device }}、{{ latestCpap.mode }} {{ latestCpap.pressureSetting }} cmH2O）です。
      </p>
      <table v-if="cpapReports.length > 1" class="stack-table" style="margin-top: 8px">
        <thead>
          <tr><th>期間</th><th>AHI</th><th>平均使用時間</th><th>4時間以上の日</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in cpapHistory" :key="row.periodStart">
            <td data-label="期間">{{ row.periodStart }} 〜 {{ row.periodEnd }}</td>
            <td data-label="AHI">{{ formatDecimal(row.ahi) }} 回/時間</td>
            <td data-label="平均使用時間">{{ formatDurationMinutes(row.avgUsageMin) }}</td>
            <td data-label="4時間以上の日">{{ formatInteger(row.daysOver4h) }} / {{ formatInteger(row.daysInPeriod) }} 日</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ShareSessionCard v-if="store.hasSession && !store.shareMode" />
  </div>
</template>
