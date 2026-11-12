<script setup>
import { computed, ref } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import LineChart from "@/components/LineChart.vue";
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

const hours = computed(() => data.value?.chatActivityHours ?? []);
const dailyHours = computed(() => data.value?.chatActivityDailyHours ?? []);
const selectedHourTab = ref("total");
const hourTabs = computed(() => {
  const dates = [...new Set(dailyHours.value.map((r) => r.date))].sort().reverse().slice(0, 7);
  return [
    { key: "total", label: "合計" },
    ...dates.map((d) => ({ key: d, label: d.replaceAll("-", "/") })),
  ];
});
const activeHourTab = computed(() =>
  hourTabs.value.some((t) => t.key === selectedHourTab.value) ? selectedHourTab.value : "total",
);
const activeHourRows = computed(() =>
  activeHourTab.value === "total"
    ? hours.value
    : dailyHours.value.filter((r) => r.date === activeHourTab.value),
);
const hourPoints = computed(() =>
  activeHourRows.value.map((r) => ({ date: `${r.hour}時`, value: r.userMessageCount })),
);
const peakHoursText = computed(() => {
  const top = [...activeHourRows.value]
    .filter((r) => r.userMessageCount !== null)
    .sort((a, b) => b.userMessageCount - a.userMessageCount)
    .slice(0, 3);
  return top.map((r) => `${r.hour}時台（${formatInteger(r.userMessageCount)}件）`).join("、");
});
const hourMetaText = computed(() => {
  if (activeHourTab.value === "total") {
    return `多い時間帯：${peakHoursText.value}。記録開始から前日までの合計です。`;
  }
  const total = activeHourRows.value.reduce((sum, r) => sum + (r.userMessageCount ?? 0), 0);
  const label = activeHourTab.value.replaceAll("-", "/");
  return `多い時間帯：${peakHoursText.value}。${label} の合計は ${formatInteger(total)} 件です。`;
});

const cards = computed(() => [
  { label: "直近7日 平均使用時間", value: formatDurationMinutes(average(last7.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近30日 平均使用時間", value: formatDurationMinutes(average(last30.value.map((r) => r.engagedMinutesEst))) },
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
      <h2 class="section-title">スマホ使用時間（直近30日）</h2>
      <LineChart :points="points" unit="分" color="#0ea5e9" />
      <p class="meta">
        使用時間は利用間隔の合計による推定です（間隔は最大20分で打ち切り）。自動配信分も含むため、目安としてご覧ください。深夜帯は23:00〜翌4:29です。
      </p>
    </section>

    <section v-if="hours.length" class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">時間帯別のメッセージ数</h2>
      <div class="hour-tabs" role="tablist" aria-label="表示期間">
        <button
          v-for="tab in hourTabs"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="tab.key === activeHourTab"
          :class="tab.key === activeHourTab ? 'hour-tab is-active' : 'hour-tab'"
          @click="selectedHourTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <BarChart :points="hourPoints" unit="件" color="#f59e0b" label-type="plain" />
      <p class="meta">{{ hourMetaText }}</p>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>使用時間</th><th>メッセージ</th><th>セッション</th><th>最初</th><th>最後</th><th>深夜帯</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in activityDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="使用時間">{{ formatDurationMinutes(row.engagedMinutesEst) }}</td>
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
