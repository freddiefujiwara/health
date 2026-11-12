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
const hourView = ref("total");
const hourDates = computed(() => [...new Set(dailyHours.value.map((r) => r.date))].sort().reverse());
const hourKeys = computed(() => ["total", ...hourDates.value]);
const activeHourKey = computed(() =>
  hourKeys.value.includes(hourView.value) ? hourView.value : "total",
);
const hourIndex = computed(() => hourKeys.value.indexOf(activeHourKey.value));
const canGoOlder = computed(() => hourIndex.value < hourKeys.value.length - 1);
const canGoNewer = computed(() => hourIndex.value > 0);
function goOlder() {
  if (canGoOlder.value) {
    hourView.value = hourKeys.value[hourIndex.value + 1];
  }
}
function goNewer() {
  if (canGoNewer.value) {
    hourView.value = hourKeys.value[hourIndex.value - 1];
  }
}
const activeHourLabel = computed(() =>
  activeHourKey.value === "total" ? "合計" : activeHourKey.value.replaceAll("-", "/"),
);
const activeHourRows = computed(() =>
  activeHourKey.value === "total"
    ? hours.value
    : dailyHours.value.filter((r) => r.date === activeHourKey.value),
);
const hourPoints = computed(() =>
  activeHourRows.value.map((r) => ({ date: `${r.hour}時`, value: r.userMessageCount })),
);
const peakHoursText = computed(() => {
  const top = [...activeHourRows.value]
    .filter((r) => r.userMessageCount !== null)
    .sort((a, b) => b.userMessageCount - a.userMessageCount)
    .slice(0, 3);
  return top.map((r) => `${r.hour}時台（${formatInteger(r.userMessageCount)}回）`).join("、");
});
const hourMetaText = computed(() => {
  if (activeHourKey.value === "total") {
    return `多い時間帯：${peakHoursText.value}。記録開始から前日までの合計です。`;
  }
  const total = activeHourRows.value.reduce((sum, r) => sum + (r.userMessageCount ?? 0), 0);
  const label = activeHourKey.value.replaceAll("-", "/");
  return `多い時間帯：${peakHoursText.value}。${label} の合計は ${formatInteger(total)} 回です。`;
});

const sleep = computed(() => data.value?.sleepEstimates ?? []);
const sleepAvg7Text = computed(() =>
  formatDurationMinutes(average(sleep.value.slice(-7).map((r) => r.durationMinutesEst))),
);

const cards = computed(() => [
  { label: "直近7日 平均使用時間", value: formatDurationMinutes(average(last7.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近30日 平均使用時間", value: formatDurationMinutes(average(last30.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近7日 平均推定睡眠", value: sleepAvg7Text.value },
  { label: "直近7日 平均活動回数", value: `${formatInteger(average(last7.value.map((r) => r.userMessageCount)))} 回` },
  { label: "直近7日 深夜帯の活動", value: `${formatInteger(sum(last7.value.map((r) => r.lateNightMessageCount)))} 回` },
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
    <p v-if="sleep.length" class="meta" style="margin-bottom: 16px">
      推定睡眠は、20時から翌8時までの間で活動が最も長く途切れた区間による推定です。実際の睡眠とは異なる場合があります。
    </p>

    <section v-if="hours.length" class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">時間帯別の活動量</h2>
      <div class="hour-nav">
        <button type="button" class="hour-nav-btn" aria-label="前の日" :disabled="!canGoOlder" @click="goOlder">←</button>
        <span class="hour-nav-label">{{ activeHourLabel }}</span>
        <button type="button" class="hour-nav-btn" aria-label="次の日" :disabled="!canGoNewer" @click="goNewer">→</button>
        <button
          type="button"
          :class="activeHourKey === 'total' ? 'hour-total-btn is-active' : 'hour-total-btn'"
          @click="hourView = 'total'"
        >
          合計
        </button>
      </div>
      <BarChart :points="hourPoints" unit="回" color="#f59e0b" label-type="plain" />
      <p class="meta">{{ hourMetaText }}</p>
    </section>

    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">スマホ使用時間（直近30日）</h2>
      <LineChart :points="points" unit="分" color="#0ea5e9" />
      <p class="meta">
        使用時間は利用間隔の合計による推定です（間隔は最大20分で打ち切り）。自動配信分も含むため、目安としてご覧ください。深夜帯は23:00〜翌4:29です。
      </p>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>使用時間</th><th>活動回数</th><th>セッション</th><th>最初</th><th>最後</th><th>深夜帯</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in activityDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="使用時間">{{ formatDurationMinutes(row.engagedMinutesEst) }}</td>
            <td data-label="活動回数">{{ formatInteger(row.userMessageCount) }} 回</td>
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

<style scoped>
.hour-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 12px;
}

.hour-nav-btn {
  border: 1px solid var(--border);
  border-radius: 999px;
  width: 36px;
  height: 36px;
  background: var(--surface-elevated);
  color: var(--link);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}

.hour-nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.hour-nav-label {
  min-width: 104px;
  text-align: center;
  font-weight: 600;
}

.hour-total-btn {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 14px;
  background: var(--surface-elevated);
  color: var(--link);
  cursor: pointer;
  font-size: 13px;
}

.hour-total-btn.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
</style>
