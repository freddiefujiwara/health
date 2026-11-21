<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import StackedBarChart from "@/components/StackedBarChart.vue";
import { formatDecimal, formatInteger } from "@/domain/format";
import { bodyCompositionChanges, weightComposition } from "@/domain/stats";

const { data } = useHealthData();

const body = computed(() => data.value?.bodyComposition ?? []);
const tanita = computed(() => body.value.filter((row) => row.measurementType === "TANITA"));
const rowsDesc = computed(() => [...body.value].reverse());

const changes = computed(() => bodyCompositionChanges(tanita.value));
const deltaText = (c) => {
  if (c.delta === 0) {
    return "前回と同じ";
  }
  const sign = c.delta > 0 ? "+" : "−";
  return `前回比 ${sign}${formatDecimal(Math.abs(c.delta), c.digits)}${c.unit ? ` ${c.unit}` : ""}`;
};

const compositionPoints = computed(() => weightComposition(tanita.value));
const fatPoints = computed(() => tanita.value.map((r) => ({ date: r.date, value: r.bodyFatPercent })));
const musclePoints = computed(() => tanita.value.map((r) => ({ date: r.date, value: r.muscleMassKg })));

const segmentLabels = {
  trunk: "体幹",
  left_arm: "左腕",
  right_arm: "右腕",
  left_leg: "左脚",
  right_leg: "右脚",
};
const latestDate = computed(() => (tanita.value.length ? tanita.value[tanita.value.length - 1].date : ""));
const latestSegments = computed(() =>
  (data.value?.segments ?? []).filter((s) => s.date === latestDate.value),
);
</script>

<template>
  <div v-if="data">
    <section v-if="changes" class="chart-card changes-card">
      <h2 class="section-title">前回からの変化（{{ changes.previousDate }} → {{ changes.date }}）</h2>
      <div class="change-grid">
        <div v-for="c in changes.changes" :key="c.key" class="change-item">
          <div class="change-label">{{ c.label }}</div>
          <div class="change-value">
            <span :class="{ 'amount-value': c.masked }">{{ formatDecimal(c.current, c.digits) }}{{ c.unit ? ` ${c.unit}` : "" }}</span>
          </div>
          <div class="change-delta" :class="`tone-${c.tone}`">
            <span :class="{ 'amount-value': c.masked }">{{ deltaText(c) }}</span>
          </div>
        </div>
      </div>
    </section>

    <div class="chart-grid">
      <section class="chart-card">
        <h2 class="section-title">体重の内訳（kg）</h2>
        <StackedBarChart :points="compositionPoints" unit="kg" hide-axis-in-private />
        <div class="composition-legend">
          <span><i class="dot dot-fat"></i>脂肪量</span>
          <span><i class="dot dot-muscle"></i>筋肉量</span>
          <span><i class="dot dot-other"></i>その他（水分・タンパク質・骨など）</span>
        </div>
        <p class="composition-note">バーの高さが体重です。減った分が脂肪か筋肉かが見分けられます。</p>
      </section>
      <section class="chart-card">
        <h2 class="section-title">体脂肪率（%）</h2>
        <LineChart :points="fatPoints" unit="%" color="#f59e0b" />
      </section>
      <section class="chart-card">
        <h2 class="section-title">筋肉量（kg）</h2>
        <LineChart :points="musclePoints" unit="kg" color="#22c55e" hide-axis-in-private />
      </section>
    </div>

    <section class="table-wrap">
      <h2 class="section-title">測定履歴</h2>
      <table class="stack-table">
        <thead>
          <tr>
            <th>日付</th><th>種別</th><th>体重</th><th>BMI</th><th>体脂肪率</th>
            <th>脂肪量</th><th>筋肉量</th><th>除脂肪量</th><th>内臓脂肪</th><th>基礎代謝</th><th>SMI</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rowsDesc" :key="row.date">
            <td data-label="日付">{{ row.date }}</td>
            <td data-label="種別">{{ row.measurementType }}</td>
            <td data-label="体重"><span class="amount-value">{{ formatDecimal(row.weightKg) }} kg</span></td>
            <td data-label="BMI">{{ formatDecimal(row.bmi) }}</td>
            <td data-label="体脂肪率">{{ formatDecimal(row.bodyFatPercent) }} %</td>
            <td data-label="脂肪量"><span class="amount-value">{{ formatDecimal(row.fatMassKg) }} kg</span></td>
            <td data-label="筋肉量"><span class="amount-value">{{ formatDecimal(row.muscleMassKg) }} kg</span></td>
            <td data-label="除脂肪量"><span class="amount-value">{{ formatDecimal(row.leanMassKg) }} kg</span></td>
            <td data-label="内臓脂肪">{{ formatInteger(row.visceralFatLevel) }}</td>
            <td data-label="基礎代謝">{{ formatInteger(row.bmrKcal) }} kcal</td>
            <td data-label="SMI">{{ formatDecimal(row.smi, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="latestSegments.length" class="table-wrap">
      <h2 class="section-title">部位別（{{ latestDate }}）</h2>
      <table>
        <thead>
          <tr><th>部位</th><th>筋肉量</th><th>脂肪率</th><th>脂肪量</th></tr>
        </thead>
        <tbody>
          <tr v-for="seg in latestSegments" :key="seg.segment">
            <td>{{ segmentLabels[seg.segment] ?? seg.segment }}</td>
            <td><span class="amount-value">{{ formatDecimal(seg.muscleMassKg) }} kg</span></td>
            <td>{{ formatDecimal(seg.fatPercent) }} %</td>
            <td><span class="amount-value">{{ formatDecimal(seg.fatMassKg) }} kg</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.changes-card {
  margin-bottom: 16px;
}
.change-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}
.change-item {
  background: var(--hatch-widget-surface-muted, rgba(148, 163, 184, 0.08));
  border-radius: 10px;
  padding: 10px 12px;
}
.change-label {
  font-size: 12px;
  opacity: 0.75;
}
.change-value {
  font-size: 20px;
  font-weight: 600;
  margin: 2px 0;
}
.change-delta {
  font-size: 12px;
}
.tone-good {
  color: #22c55e;
}
.tone-warn {
  color: #f59e0b;
}
.tone-flat {
  opacity: 0.65;
}
.composition-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  margin-top: 6px;
}
.composition-legend .dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 5px;
}
.dot-fat {
  background: #f59e0b;
}
.dot-muscle {
  background: #22c55e;
}
.dot-other {
  background: #64748b;
}
.composition-note {
  font-size: 12px;
  opacity: 0.75;
  margin: 6px 0 0;
}
</style>
