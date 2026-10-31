<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import { formatInteger } from "@/domain/format";
import { average, recentRows, sum } from "@/domain/stats";

const { data } = useHealthData();

const daily = computed(() => data.value?.dailyNutrition ?? []);
const dailyDesc = computed(() => [...daily.value].reverse());
const last30 = computed(() => recentRows(daily.value, 30));
const goals = computed(() => data.value?.goals ?? {});
const periods = computed(() => [...(data.value?.periodSummaries ?? [])].reverse());

const intakePoints = computed(() => last30.value.map((r) => ({ date: r.date, value: r.intakeKcal })));
const balancePoints = computed(() => last30.value.map((r) => ({ date: r.date, value: r.balanceKcal })));

const cards = computed(() => [
  { label: "直近30日 平均摂取", value: `${formatInteger(average(last30.value.map((r) => r.intakeKcal)))} kcal` },
  { label: "直近30日 平均消費", value: `${formatInteger(average(last30.value.map((r) => r.expenditureKcal)))} kcal` },
  { label: "直近30日 平均収支", value: `${formatInteger(average(last30.value.map((r) => r.balanceKcal)))} kcal` },
  { label: "直近30日 合計収支", value: `${formatInteger(sum(last30.value.map((r) => r.balanceKcal)))} kcal` },
]);
</script>

<template>
  <div v-if="data">
    <div class="card-grid">
      <section v-for="card in cards" :key="card.label" class="card">
        <h2>{{ card.label }}</h2>
        <p>{{ card.value }}</p>
      </section>
    </div>

    <div class="chart-grid">
      <section class="chart-card">
        <h2 class="section-title">摂取カロリー（直近30日）</h2>
        <BarChart
          :points="intakePoints"
          unit="kcal"
          :guideline-value="goals.intakeGuidelineKcal"
          :guideline-label="`目安 ${goals.intakeGuidelineKcal}kcal`"
        />
      </section>
      <section class="chart-card">
        <h2 class="section-title">収支（直近30日）</h2>
        <BarChart :points="balancePoints" unit="kcal" signed color="#3b82f6" />
      </section>
    </div>

    <section class="table-wrap">
      <h2 class="section-title">期間集計</h2>
      <table>
        <thead>
          <tr><th>期間</th><th>平均摂取</th><th>合計収支</th><th>平均収支</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in periods" :key="row.startDate">
            <td>{{ row.startDate }} 〜 {{ row.endDate }}</td>
            <td>{{ formatInteger(row.averageIntakeKcal) }} kcal</td>
            <td>{{ formatInteger(row.totalBalanceKcal) }} kcal</td>
            <td>{{ formatInteger(row.averageBalanceKcal) }} kcal</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>摂取</th><th>消費</th><th>収支</th><th>状態</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in dailyDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="摂取">{{ formatInteger(row.intakeKcal) }} kcal</td>
            <td data-label="消費">{{ formatInteger(row.expenditureKcal) }} kcal</td>
            <td data-label="収支">
              <span :class="row.balanceKcal !== null && row.balanceKcal < 0 ? 'is-positive' : 'is-negative'">
                {{ formatInteger(row.balanceKcal) }} kcal
              </span>
            </td>
            <td data-label="状態">{{ row.completeness }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
