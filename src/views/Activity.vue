<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import { formatDurationMinutes, formatInteger } from "@/domain/format";
import { average, recentRows, sum } from "@/domain/stats";

const { data } = useHealthData();

const activity = computed(() => data.value?.chatActivity ?? []);
const activityDesc = computed(() => [...activity.value].reverse());
const last30 = computed(() => recentRows(activity.value, 30));
const last7 = computed(() => recentRows(activity.value, 7));

const points = computed(() =>
  last30.value.map((r) => ({ date: r.date, value: r.engagedMinutesEst })),
);

const cards = computed(() => [
  { label: "直近7日 平均会話時間", value: formatDurationMinutes(average(last7.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近30日 平均会話時間", value: formatDurationMinutes(average(last30.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近7日 平均メッセージ数", value: `${formatInteger(average(last7.value.map((r) => r.userMessageCount)))} 件` },
  { label: "直近7日 深夜帯メッセージ", value: `${formatInteger(sum(last7.value.map((r) => r.lateNightMessageCount)))} 件` },
  { label: "記録日数", value: `${activity.value.length} 日` },
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
      <h2 class="section-title">推定会話時間（直近30日）</h2>
      <BarChart :points="points" unit="分" color="#0ea5e9" />
      <p class="meta">
        会話時間はメッセージ間隔の合計による推定です（間隔は最大20分で打ち切り）。自動配信のメッセージも含むため、目安としてご覧ください。深夜帯は23:00〜翌4:29です。
      </p>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>推定会話時間</th><th>メッセージ</th><th>セッション</th><th>最初</th><th>最後</th><th>深夜帯</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in activityDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="推定会話時間">{{ formatDurationMinutes(row.engagedMinutesEst) }}</td>
            <td data-label="メッセージ">{{ formatInteger(row.userMessageCount) }} 件</td>
            <td data-label="セッション">{{ formatInteger(row.sessionCount) }}</td>
            <td data-label="最初">{{ row.firstMessageAt || "-" }}</td>
            <td data-label="最後">{{ row.lastMessageAt || "-" }}</td>
            <td data-label="深夜帯">{{ formatInteger(row.lateNightMessageCount) }} 件</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
