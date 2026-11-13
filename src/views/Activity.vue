<script setup>
import { computed, ref } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import LineChart from "@/components/LineChart.vue";
import { formatDurationMinutes, formatInteger } from "@/domain/format";
import { average, movingAverage, recentRows } from "@/domain/stats";

const { data } = useHealthData();

const activity = computed(() => data.value?.chatActivity ?? []);
const activityDesc = computed(() => [...activity.value].reverse());
const last30 = computed(() => recentRows(activity.value, 30));
const last7 = computed(() => recentRows(activity.value, 7));

// Sleep chart: 7-day moving average of the estimated sleep duration,
// over the last 30 wake dates.
const points = computed(() => {
  const averaged = movingAverage(
    sleep.value.map((r) => r.durationMinutesEst),
    7,
  );
  const rows = sleep.value.map((r, i) => ({
    date: r.date,
    value: averaged[i] === null ? null : Math.round(averaged[i]),
  }));
  return recentRows(rows, 30);
});

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
  const bandNote = sleepBands.value.length
    ? `紫の帯は推定睡眠として数えた区間です（${sleepBands.value.map((b) => b.note).join("／")}）。`
    : "";
  return `多い時間帯：${peakHoursText.value}。${label} の合計は ${formatInteger(total)} 回です。${bandNote}`;
});

const sleep = computed(() => data.value?.sleepEstimates ?? []);
const sleepAvgText = (days) =>
  formatDurationMinutes(average(sleep.value.slice(-days).map((r) => r.durationMinutesEst)));

// Late-night activity minutes per date, summed from the hourly breakdown
// (hours 23 and 0-4 of the same calendar date, matching the window used
// for the late-night counts: 23:00-04:29).
const LATE_NIGHT_HOURS = [23, 0, 1, 2, 3, 4];
const lateNightMinutesByDate = computed(() => {
  const map = new Map();
  for (const row of dailyHours.value) {
    if (LATE_NIGHT_HOURS.includes(row.hour)) {
      map.set(row.date, (map.get(row.date) ?? 0) + (row.engagedMinutesEst ?? 0));
    }
  }
  return map;
});
const lateNightAvgText = (rows) =>
  formatDurationMinutes(
    average(rows.map((r) => lateNightMinutesByDate.value.get(r.date) ?? 0)),
  );

function timeToHours(t) {
  if (!t) {
    return null;
  }
  const [hh, mm] = t.split(":").map(Number);
  return hh + mm / 60;
}

function dayDiff(from, to) {
  const a = Date.UTC(...from.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
  const b = Date.UTC(...to.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
  return Math.round((b - a) / 86400000);
}

// Sleep bands (in fractional hours) overlapping the selected calendar day.
// A sleep row belongs to its wake date; its start is on the previous evening
// when the start time is 20:00 or later, otherwise on the wake date itself.
const sleepBands = computed(() => {
  if (activeHourKey.value === "total") {
    return [];
  }
  const day = activeHourKey.value;
  const result = [];
  for (const row of sleep.value) {
    const startH = timeToHours(row.sleepStartEst);
    const endH = timeToHours(row.sleepEndEst);
    if (startH === null || endH === null) {
      continue;
    }
    const shift = dayDiff(day, row.date) * 24;
    const start = startH - (startH >= 20 ? 24 : 0) + shift;
    const end = endH + shift;
    const from = Math.max(0, start);
    const to = Math.min(24, end);
    if (from < to) {
      result.push({
        from,
        to,
        label: formatDurationMinutes(row.durationMinutesEst),
        note: `${row.sleepStartEst}–${row.sleepEndEst}、${formatDurationMinutes(row.durationMinutesEst)}`,
      });
    }
  }
  return result;
});
const hourBands = computed(() => sleepBands.value);

const cards = computed(() => [
  { label: "直近7日 平均活動時間", value: formatDurationMinutes(average(last7.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近30日 平均活動時間", value: formatDurationMinutes(average(last30.value.map((r) => r.engagedMinutesEst))) },
  { label: "直近7日 平均睡眠時間", value: sleepAvgText(7) },
  { label: "直近30日 平均睡眠時間", value: sleepAvgText(30) },
  { label: "直近7日 深夜帯の活動時間", value: lateNightAvgText(last7.value) },
  { label: "直近30日 深夜帯の活動時間", value: lateNightAvgText(last30.value) },
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
      <BarChart :points="hourPoints" unit="回" color="#f59e0b" label-type="plain" :bands="hourBands" />
      <p class="meta">{{ hourMetaText }}</p>
    </section>

    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">睡眠時間（直近30日・7日移動平均）</h2>
      <LineChart :points="points" unit="分" color="#8b5cf6" />
      <p class="meta">
        線は各日の推定睡眠時間を7日移動平均したものです。深夜帯は23:00〜翌4:29です。
      </p>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>活動時間</th><th>活動回数</th><th>セッション</th><th>最初</th><th>最後</th><th>深夜帯</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in activityDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="活動時間">{{ formatDurationMinutes(row.engagedMinutesEst) }}</td>
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
