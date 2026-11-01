import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BarChart from "@/components/BarChart.vue";

const points = [
  { date: "2026-10-29", value: 10234 },
  { date: "2026-10-30", value: 11529 },
  { date: "2026-10-31", value: 61 },
];

describe("bar chart tooltip", () => {
  it("renders hit areas for each bar and a hidden tooltip initially", () => {
    const wrapper = mount(BarChart, { props: { points, unit: "歩" } });
    expect(wrapper.findAll("rect.hit")).toHaveLength(3);
    expect(wrapper.find(".chart-tooltip").exists()).toBe(false);
  });

  it("shows the date and grouped value when a bar is hovered", async () => {
    const wrapper = mount(BarChart, { props: { points, unit: "歩" } });
    await wrapper.findAll("rect.hit")[1].trigger("pointerenter");
    const tooltip = wrapper.find(".chart-tooltip");
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain("2026/10/30");
    expect(tooltip.text()).toContain("11,529歩");
  });

  it("shows negative values for signed charts when tapped", async () => {
    const wrapper = mount(BarChart, {
      props: {
        points: [
          { date: "2026-10-30", value: -936 },
          { date: "2026-10-31", value: 250 },
        ],
        unit: " kcal",
        signed: true,
      },
    });
    await wrapper.findAll("rect.hit")[0].trigger("pointerdown");
    const tooltip = wrapper.find(".chart-tooltip");
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain("-936 kcal");
  });

  it("hides the tooltip when the pointer leaves the chart", async () => {
    const wrapper = mount(BarChart, { props: { points, unit: "歩" } });
    await wrapper.findAll("rect.hit")[0].trigger("pointerenter");
    expect(wrapper.find(".chart-tooltip").exists()).toBe(true);
    await wrapper.find("svg").trigger("pointerleave");
    expect(wrapper.find(".chart-tooltip").exists()).toBe(false);
  });
});
