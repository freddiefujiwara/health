<script setup>
import { computed, ref, watchEffect } from "vue";
import { useHealthData } from "@/composables/useHealthData";
import LineChart from "@/components/LineChart.vue";
import { featuredLabSeries, groupLabResults } from "@/domain/labs";

const { data } = useHealthData();

const labResults = computed(() => data.value?.labResults ?? []);
const groups = computed(() => groupLabResults(labResults.value));

const featured = computed(() => featuredLabSeries(labResults.value));
const activeFeatured = ref("");
watchEffect(() => {
  if (!featured.value.some((entry) => entry.item === activeFeatured.value)) {
    activeFeatured.value = featured.value[0]?.item ?? "";
  }
});
const activeEntry = computed(
  () => featured.value.find((entry) => entry.item === activeFeatured.value) ?? null,
);
function displayValue(row) {
  return row.value === "" || row.value === null || row.value === undefined ? "-" : String(row.value);
}
</script>

<template>
  <div v-if="data">
    <section class="chart-card" style="margin-bottom: 16px">
      <h2 class="section-title">注目項目の推移</h2>
      <div class="lab-tabs" role="tablist" aria-label="注目項目">
        <button
          v-for="entry in featured"
          :key="entry.item"
          type="button"
          role="tab"
          :aria-selected="entry.item === activeFeatured"
          :class="entry.item === activeFeatured ? 'lab-tab is-active' : 'lab-tab'"
          @click="activeFeatured = entry.item"
        >
          {{ entry.item }}
        </button>
      </div>
      <LineChart
        v-if="activeEntry"
        :points="activeEntry.points"
        :unit="activeEntry.unit"
        color="#0ea5e9"
      />
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
.lab-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 12px;
}

.lab-tab {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 12px;
  background: var(--surface-elevated);
  color: var(--link);
  font-size: 0.9rem;
  cursor: pointer;
}

.lab-tab.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
</style>
