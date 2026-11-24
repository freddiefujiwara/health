<script setup>
import { computed, ref } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import BarChart from "@/components/BarChart.vue";
import LineChart from "@/components/LineChart.vue";
import { formatDateWithWeekday, formatDurationMinutes, formatInteger } from "@/domain/format";
import { average, movingAverage, recentRows } from "@/domain/stats";
import { lateNightMinutesByDate as computeLateNightMinutesByDate, sleepBandsForDay } from "@/domain/activity";

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

const workHours = computed(() => data.value?.workHours ?? []);
const workHoursDesc = computed(() => [...workHours.value].reverse().slice(0, 14));
const confirmedWork = computed(() =>
  workHours.value.filter((r) => r.status === "確定" && r.netWorkMinutes !== null),
);
const workAvg7 = computed(() => average(recentRows(confirmedWork.value, 7).map((r) => r.netWorkMinutes)));
const workAvg30 = computed(() => average(recentRows(confirmedWork.value, 30).map((r) => r.netWorkMinutes)));

const homeHours = computed(() => data.value?.homeHours ?? []);
const homeHoursDesc = computed(() => [...homeHours.value].reverse().slice(0, 14));
const confirmedHome = computed(() =>
  homeHours.value.filter((r) => r.status === "確定" && r.homeMinutes !== null),
);
const homeAvg7 = computed(() => average(recentRows(confirmedHome.value, 7).map((r) => r.homeMinutes)));
const homeAvg30 = computed(() => average(recentRows(confirmedHome.value, 30).map((r) => r.homeMinutes)));

const homeSegments = computed(() => data.value?.homeSegments ?? []);
const homeTimelineDays = computed(() => {
  const byDate = new Map();
  homeSegments.value.forEach((seg) => {
    if (!byDate.has(seg.date)) {
      byDate.set(seg.date, []);
    }
    byDate.get(seg.date).push(seg);
  });
  return [...byDate.entries()]
    .map(([date, segments]) => ({ date, segments }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);
});
const formatMinuteOfDay = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

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
  activeHourKey.value === "total" ? "合計" : formatDateWithWeekday(activeHourKey.value),
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
  const label = formatDateWithWeekday(activeHourKey.value);
  const bandNote = sleepBands.value.length
    ? `紫の帯は推定睡眠として数えた区間です（${sleepBands.value.map((b) => b.note).join("／")}）。`
    : "";
  return `多い時間帯：${peakHoursText.value}。${label} の合計は ${formatInteger(total)} 回です。${bandNote}`;
});

const sleep = computed(() => data.value?.sleepEstimates ?? []);
const sleepAvgText = (days) =>
  formatDurationMinutes(average(sleep.value.slice(-days).map((r) => r.durationMinutesEst)));

// Late-night activity minutes per date, summed from the hourly breakdown.
const lateNightMinutesByDate = computed(() => computeLateNightMinutesByDate(dailyHours.value));
const lateNightAvgText = (rows) =>
  formatDurationMinutes(
    average(rows.map((r) => lateNightMinutesByDate.value.get(r.date) ?? 0)),
  );

const sleepBands = computed(() =>
  activeHourKey.value === "total" ? [] : sleepBandsForDay(sleep.value, activeHourKey.value),
);
const hourBands = computed(() => sleepBands.value);

// Daily table rows: activity time, sleep time and late-night activity
// time per date, joined from the three series by date.
const dailyRows = computed(() => {
  const sleepByDate = new Map(sleep.value.map((r) => [r.date, r.durationMinutesEst]));
  return activityDesc.value.map((r) => ({
    date: r.date,
    activityMinutes: r.engagedMinutesEst,
    sleepMinutes: sleepByDate.get(r.date) ?? null,
    lateNightMinutes: lateNightMinutesByDate.value.get(r.date) ?? 0,
  }));
});

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
      <LineChart
        :points="points"
        unit="分"
        color="#8b5cf6"
        :y-tick-step="30"
        :y-tick-format="(v) => (v / 60).toFixed(1)"
      />
      <p class="meta">
        線は各日の推定睡眠時間を7日移動平均したものです。深夜帯は23:00〜翌4:29です。
      </p>
    </section>

    <section class="table-wrap">
      <h2 class="section-title">日別</h2>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>活動時間</th><th>睡眠時間</th><th>深夜帯活動時間</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in dailyRows" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="活動時間">{{ formatDurationMinutes(row.activityMinutes) }}</td>
            <td data-label="睡眠時間">{{ row.sleepMinutes === null ? "-" : formatDurationMinutes(row.sleepMinutes) }}</td>
            <td data-label="深夜帯活動時間">{{ formatDurationMinutes(row.lateNightMinutes) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-wrap" v-if="workHours.length">
      <h2 class="section-title">勤務時間</h2>
      <p class="meta">
        確定した日の平均：直近7日 {{ workAvg7 === null ? "-" : formatDurationMinutes(workAvg7) }}／直近30日
        {{ workAvg30 === null ? "-" : formatDurationMinutes(workAvg30) }}。職場の出退記録（presence）から計算しています。未確定の日は平均に入れていません。
      </p>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>勤務時間</th><th>出社</th><th>退社</th><th>状態</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in workHoursDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="勤務時間">{{ row.netWorkMinutes === null ? "-" : formatDurationMinutes(row.netWorkMinutes) }}</td>
            <td data-label="出社">{{ row.firstArrive || "-" }}</td>
            <td data-label="退社">{{ row.lastLeave || "-" }}</td>
            <td data-label="状態">{{ row.status }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="table-wrap" v-if="homeHours.length">
      <h2 class="section-title">家にいる時間</h2>
      <p class="meta">
        確定した日の平均：直近7日 {{ homeAvg7 === null ? "-" : formatDurationMinutes(homeAvg7) }}／直近30日
        {{ homeAvg30 === null ? "-" : formatDurationMinutes(homeAvg30) }}。自宅の出入り記録（presence）から計算しています。未確定の日は平均に入れていません。
      </p>
      <table class="stack-table">
        <thead>
          <tr><th>日付</th><th>在宅時間</th><th>最初の外出</th><th>最後の帰宅</th><th>外出回数</th><th>状態</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in homeHoursDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="在宅時間">{{ row.homeMinutes === null ? "-" : formatDurationMinutes(row.homeMinutes) }}</td>
            <td data-label="最初の外出">{{ row.firstLeave || "-" }}</td>
            <td data-label="最後の帰宅">{{ row.lastArrive || "-" }}</td>
            <td data-label="外出回数">{{ row.outingCount === null ? "-" : row.outingCount }}</td>
            <td data-label="状態">{{ row.status }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="homeTimelineDays.length" class="home-timeline">
        <h3 class="subsection-title">在宅・外出の時系列（直近7日）</h3>
        <ul class="timeline-list">
          <li v-for="day in homeTimelineDays" :key="day.date">
            <span class="timeline-date">{{ formatDateWithWeekday(day.date) }}</span>
            <ul class="timeline-segs">
              <li v-for="(seg, i) in day.segments" :key="i">
                {{ formatMinuteOfDay(seg.startMinute) }}–{{ formatMinuteOfDay(seg.endMinute) }}
                {{ seg.state === "home" ? "家" : "外出" }}（{{ formatDurationMinutes(seg.minutes) }}）
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.subsection-title {
  font-size: 15px;
  margin: 18px 0 8px;
}

.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.timeline-date {
  display: block;
  font-weight: 600;
  margin-bottom: 2px;
}

.timeline-segs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
  line-height: 1.7;
}

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
