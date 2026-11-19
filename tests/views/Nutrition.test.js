import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import Nutrition from "@/views/Nutrition.vue";
import BarChart from "@/components/BarChart.vue";
import LineChart from "@/components/LineChart.vue";
import { useHealthStore } from "@/stores/health";
import sampleApi from "@/mocks/sampleApi.json";
import { normalizeHealth } from "@/domain/normalize";

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  const data = normalizeHealth(sampleApi);
  data.periodSummaries = [
    { startDate: "2026-08-23", endDate: "2026-08-23", days: 1, averageIntakeKcal: 1847, averageExpenditureKcal: 2783, totalBalanceKcal: -936, averageBalanceKcal: -936 },
    { startDate: "2026-08-24", endDate: "2026-08-30", days: 7, averageIntakeKcal: 2137, averageExpenditureKcal: 2984, totalBalanceKcal: -5928, averageBalanceKcal: -847 },
    { startDate: "2026-08-31", endDate: "2026-09-06", days: 7, averageIntakeKcal: 2112, averageExpenditureKcal: 3022, totalBalanceKcal: -6373, averageBalanceKcal: -910 },
    { startDate: "2026-09-07", endDate: "2026-09-13", days: 6, averageIntakeKcal: 2000, averageExpenditureKcal: 2800, totalBalanceKcal: -4800, averageBalanceKcal: -800 },
  ];
  data.dailyNutrition = [
    { date: "2026-11-14", intakeKcal: 2000, expenditureKcal: 2900, balanceKcal: -900, completeness: "完了" },
    { date: "2026-11-07", intakeKcal: 2200, expenditureKcal: 2900, balanceKcal: -700, completeness: "完了" },
    { date: "2026-11-09", intakeKcal: 1800, expenditureKcal: 2800, balanceKcal: -1000, completeness: "完了" },
    { date: "2026-11-16", intakeKcal: 1600, expenditureKcal: 2800, balanceKcal: -1200, completeness: "完了" },
    { date: "2026-11-11", intakeKcal: 9999, expenditureKcal: 2800, balanceKcal: 7199, completeness: "途中（当日分）" },
  ];
  store.data = data;
  store.source = "live";
  return mount(Nutrition, { global: { plugins: [pinia] } });
}

describe("nutrition weekly average chart", () => {
  it("shows the weekly average chart at the top with three tabs", () => {
    const wrapper = buildWrapper();
    const firstSection = wrapper.find("section.chart-card");
    expect(firstSection.find("h2").text()).toBe("週ごとの平均");
    const tabs = firstSection.findAll("button.lab-tab");
    expect(tabs.map((t) => t.text())).toEqual(["平均収支", "平均摂取", "平均消費"]);
    expect(tabs[0].classes()).toContain("is-active");
  });

  it("defaults to the average balance of weeks with at least 6 days, skipping stub weeks", () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[0];
    const chart = section.findComponent(LineChart);
    expect(chart.props("points")).toEqual([
      { date: "2026-08-24", value: -847 },
      { date: "2026-08-31", value: -910 },
      { date: "2026-09-07", value: -800 },
    ]);
  });

  it("passes the trend line endpoints for the dashed overlay", () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[0];
    const chart = section.findComponent(LineChart);
    expect(chart.props("projectionPoints")).toEqual([
      { date: "2026-08-24", value: -876 },
      { date: "2026-09-07", value: -829 },
    ]);
  });

  it("switches the charted weekly average by tab", async () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[0];
    const tabs = section.findAll("button.lab-tab");

    await tabs[2].trigger("click");
    let chart = section.findComponent(LineChart);
    expect(chart.props("points")).toEqual([
      { date: "2026-08-24", value: 2984 },
      { date: "2026-08-31", value: 3022 },
      { date: "2026-09-07", value: 2800 },
    ]);
    expect(chart.props("goalValue")).toBeNull();
    expect(tabs[2].classes()).toContain("is-active");

    await tabs[1].trigger("click");
    chart = section.findComponent(LineChart);
    expect(chart.props("points")).toEqual([
      { date: "2026-08-24", value: 2137 },
      { date: "2026-08-31", value: 2112 },
      { date: "2026-09-07", value: 2000 },
    ]);
    expect(chart.props("goalValue")).toBe(1990);
  });
});

describe("nutrition weekday intake chart", () => {
  it("shows the weekday chart below the weekly chart", () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[1];
    expect(section.find("h2").text()).toBe("曜日ごとの平均摂取");
  });

  it("averages intake per weekday from the Saturday injection day, completed days only", () => {
    const wrapper = buildWrapper();
    const section = wrapper.findAll("section.chart-card")[1];
    const chart = section.findComponent(BarChart);
    const points = chart.props("points");
    expect(points[0]).toEqual({ date: "土（注射日）", value: 2100 });
    expect(points[2]).toEqual({ date: "月", value: 1700 });
    expect(chart.props("scatterPoints")).toHaveLength(4);
    expect(chart.props("guidelineValue")).toBe(1900);
  });
});
