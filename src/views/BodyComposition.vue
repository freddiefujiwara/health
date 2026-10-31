<script setup>
import { computed } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import { formatDecimal, formatInteger } from "@/domain/format";

const { data } = useHealthData();

const body = computed(() => data.value?.bodyComposition ?? []);
const tanita = computed(() => body.value.filter((row) => row.measurementType === "TANITA"));
const rowsDesc = computed(() => [...body.value].reverse());

const weightPoints = computed(() => tanita.value.map((r) => ({ date: r.date, value: r.weightKg })));
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
    <div class="chart-grid">
      <section class="chart-card">
        <h2 class="section-title">体重（kg）</h2>
        <LineChart :points="weightPoints" unit="kg" />
      </section>
      <section class="chart-card">
        <h2 class="section-title">体脂肪率（%）</h2>
        <LineChart :points="fatPoints" unit="%" color="#f59e0b" />
      </section>
      <section class="chart-card">
        <h2 class="section-title">筋肉量（kg）</h2>
        <LineChart :points="musclePoints" unit="kg" color="#22c55e" />
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
