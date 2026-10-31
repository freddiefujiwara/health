<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import { formatDecimal, formatInteger } from "@/domain/format";
import { average, recentRows, sum } from "@/domain/stats";

const { data } = useHealthData();

const steps = computed(() => data.value?.steps ?? []);
const stepsDesc = computed(() => [...steps.value].reverse());
const last30 = computed(() => recentRows(steps.value, 30));
const last7 = computed(() => recentRows(steps.value, 7));

const points = computed(() => last30.value.map((r) => ({ date: r.date, value: r.steps })));

const cards = computed(() => [
  { label: "直近7日 平均", value: `${formatInteger(average(last7.value.map((r) => r.steps)))} 歩` },
  { label: "直近30日 平均", value: `${formatInteger(average(last30.value.map((r) => r.steps)))} 歩` },
  { label: "全期間 平均", value: `${formatInteger(average(steps.value.map((r) => r.steps)))} 歩` },
  { label: "全期間 合計", value: `${formatInteger(sum(steps.value.map((r) => r.steps)))} 歩` },
  { label: "記録日数", value: `${steps.value.length} 日` },
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

    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">歩数（直近30日）</h2>
      <BarChart :points="points" unit="歩" color="#8b5cf6" />
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>歩数</th><th>距離</th><th>階数</th><th>状態</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in stepsDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="歩数">{{ formatInteger(row.steps) }} 歩</td>
            <td data-label="距離">{{ formatDecimal(row.distanceM ? row.distanceM / 1000 : null, 2) }} km</td>
            <td data-label="階数">{{ formatInteger(row.flightsClimbed) }}</td>
            <td data-label="状態">{{ row.completeness }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
