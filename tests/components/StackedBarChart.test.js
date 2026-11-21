import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StackedBarChart from "@/components/StackedBarChart.vue";

const points = [
  { date: "2026-07-25", totalKg: 99.7, fatKg: 34.5, muscleKg: 61.8, otherKg: 3.4 },
  { date: "2026-11-21", totalKg: 88.9, fatKg: 26.1, muscleKg: 59.6, otherKg: 3.2 },
];

describe("stacked bar chart", () => {
  it("renders three segments and a hit area per measurement", () => {
    const wrapper = mount(StackedBarChart, { props: { points } });
    expect(wrapper.findAll("rect.segment")).toHaveLength(6);
    expect(wrapper.findAll("rect.segment-fatKg")).toHaveLength(2);
    expect(wrapper.findAll("rect.segment-muscleKg")).toHaveLength(2);
    expect(wrapper.findAll("rect.segment-otherKg")).toHaveLength(2);
    expect(wrapper.findAll("rect.hit")).toHaveLength(2);
    expect(wrapper.find(".chart-tooltip").exists()).toBe(false);
  });

  it("shows the total and the breakdown in the tooltip", async () => {
    const wrapper = mount(StackedBarChart, { props: { points } });
    await wrapper.findAll("rect.hit")[1].trigger("pointerenter");
    const tooltip = wrapper.find(".chart-tooltip");
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain("2026/11/21");
    expect(tooltip.text()).toContain("88.9kg");
    expect(tooltip.text()).toContain("脂肪 26.1");
    expect(tooltip.text()).toContain("筋肉 59.6");
  });

  it("draws the line overlay and right axis when line points are given", () => {
    const wrapper = mount(StackedBarChart, {
      props: {
        points,
        linePoints: [
          { date: "2026-07-25", value: 34.6 },
          { date: "2026-11-21", value: 29.4 },
        ],
      },
    });
    expect(wrapper.find("path.line-overlay").exists()).toBe(true);
    expect(wrapper.findAll("circle.line-dot")).toHaveLength(2);
    expect(wrapper.text()).toContain("30%");
  });

  it("shows an empty message without data", () => {
    const wrapper = mount(StackedBarChart, { props: { points: [] } });
    expect(wrapper.text()).toContain("データがありません");
    expect(wrapper.findAll("rect.hit")).toHaveLength(0);
  });
});
