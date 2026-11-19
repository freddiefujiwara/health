import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import Nutrition from "@/views/Nutrition.vue";
import BarChart from "@/components/BarChart.vue";
import { useHealthStore } from "@/stores/health";
import sampleApi from "@/mocks/sampleApi.json";
import { normalizeHealth } from "@/domain/normalize";

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  const data = normalizeHealth(sampleApi);
  data.periodSummaries = [
    { startDate: "2026-08-23", endDate: "2026-08-23", days: 1, averageIntakeKcal: 1847, totalBalanceKcal: -936, averageBalanceKcal: -936 },
    { startDate: "2026-08-24", endDate: "2026-08-30", days: 7, averageIntakeKcal: 2137, totalBalanceKcal: -5928, averageBalanceKcal: -847 },
    { startDate: "2026-08-31", endDate: "2026-09-06", days: 7, averageIntakeKcal: 2112, totalBalanceKcal: -6373, averageBalanceKcal: -910 },
    { startDate: "2026-09-07", endDate: "2026-09-13", days: 6, averageIntakeKcal: 2000, totalBalanceKcal: -4800, averageBalanceKcal: -800 },
  ];
  store.data = data;
  store.source = "live";
  return mount(Nutrition, { global: { plugins: [pinia] } });
}

describe("nutrition weekly balance chart", () => {
  it("shows the weekly average balance chart at the top", () => {
    const wrapper = buildWrapper();
    const firstSection = wrapper.find("section.chart-card");
    expect(firstSection.find("h2").text()).toBe("週ごとの平均収支");
  });

  it("charts weeks with at least 6 days, oldest first, skipping stub weeks", () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[0];
    const chart = section.findComponent(BarChart);
    expect(chart.props("points")).toEqual([
      { date: "2026-08-24", value: -847 },
      { date: "2026-08-31", value: -910 },
      { date: "2026-09-07", value: -800 },
    ]);
    expect(chart.props("signed")).toBe(true);
  });
});
