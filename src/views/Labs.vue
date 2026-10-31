<script setup>
import { computed, ref, watchEffect } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import {
  featuredLabSeries,
  groupLabResults,
  labItemSeries,
  labItemUnit,
  numericLabItems,
} from "@/domain/labs";

const { data } = useHealthData();

const labResults = computed(() => data.value?.labResults ?? []);
const groups = computed(() => groupLabResults(labResults.value));
const items = computed(() => numericLabItems(labResults.value));

const selectedItem = ref("");
watchEffect(() => {
  if (!items.value.includes(selectedItem.value)) {
    selectedItem.value = items.value.includes("γ-GTP") ? "γ-GTP" : (items.value[0] ?? "");
  }
});

const featured = computed(() => featuredLabSeries(labResults.value));
const series = computed(() => labItemSeries(labResults.value, selectedItem.value));
const unit = computed(() => labItemUnit(labResults.value, selectedItem.value));

function displayValue(row) {
  return row.value === "" || row.value === null || row.value === undefined ? "-" : String(row.value);
}
</script>

<template>
  <div v-if="data">
    <h2 class="section-title">注目項目の推移</h2>
    <div class="chart-grid" style="margin-bottom: 16px">
      <section v-for="entry in featured" :key="entry.item" class="chart-card">
        <h3 class="section-title">{{ entry.item }}</h3>
        <LineChart :points="entry.points" :unit="entry.unit" color="#0ea5e9" />
      </section>
    </div>

    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">項目の推移（全項目から選択）</h2>
      <label class="meta" for="lab-item-select">項目</label>
      <select id="lab-item-select" v-model="selectedItem" class="lab-select">
        <option v-for="item in items" :key="item" :value="item">{{ item }}</option>
      </select>
      <LineChart :points="series" :unit="unit" color="#0ea5e9" />
      <p class="meta">数値で記録された項目だけを選べます。</p>
    </section>

    <section v-for="group in groups" :key="group.date" class="table-wrap">
      <h2 class="section-title">{{ group.date }}（{{ group.panel }}）</h2>
      <table>
        <thead>
          <tr>
            <th>分類</th>
            <th>項目</th>
            <th>結果</th>
            <th>単位</th>
            <th>参考値</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in group.rows" :key="`${row.item}-${row.category}`">
            <td data-label="分類">{{ row.category }}</td>
            <td data-label="項目">{{ row.item }}</td>
            <td data-label="結果">
              {{ displayValue(row) }}
              <span v-if="row.flag === 'H'" class="is-negative"> H</span>
              <span v-else-if="row.flag === 'L'" class="is-negative"> L</span>
            </td>
            <td data-label="単位">{{ row.unit }}</td>
            <td data-label="参考値">{{ row.reference }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <p v-else class="meta">読み込み中です。</p>
</template>

<style scoped>
.lab-select {
  margin: 4px 0 12px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
</style>
