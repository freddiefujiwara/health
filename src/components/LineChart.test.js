import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import LineChart from "@/components/LineChart.vue";

const points = [
  { date: "2026-07-25", value: 99.7 },
  { date: "2026-10-17", value: 91.5 },
];

describe("line chart tooltip", () => {
  it("renders hit areas for each point and a hidden tooltip initially", () => {
    const wrapper = mount(LineChart, { props: { points, unit: " kg" } });
    expect(wrapper.findAll("circle.hit")).toHaveLength(2);
    expect(wrapper.find(".chart-tooltip").exists()).toBe(false);
  });

  it("shows the date and value when a point is hovered", async () => {
    const wrapper = mount(LineChart, { props: { points, unit: " kg" } });
    await wrapper.findAll("circle.hit")[1].trigger("pointerenter");
    const tooltip = wrapper.find(".chart-tooltip");
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain("2026/10/17");
    expect(tooltip.text()).toContain("91.5 kg");
  });

  it("shows the value when a point is tapped (pointerdown)", async () => {
    const wrapper = mount(LineChart, { props: { points, unit: " kg" } });
    await wrapper.findAll("circle.hit")[0].trigger("pointerdown");
    const tooltip = wrapper.find(".chart-tooltip");
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain("99.7 kg");
  });

  it("hides the tooltip when the pointer leaves the chart", async () => {
    const wrapper = mount(LineChart, { props: { points, unit: " kg" } });
    await wrapper.findAll("circle.hit")[0].trigger("pointerenter");
    expect(wrapper.find(".chart-tooltip").exists()).toBe(true);
    await wrapper.find("svg").trigger("pointerleave");
    expect(wrapper.find(".chart-tooltip").exists()).toBe(false);
  });

  it("marks the value for privacy masking when hideAxisInPrivate is set", async () => {
    const wrapper = mount(LineChart, {
      props: { points, unit: " kg", hideAxisInPrivate: true },
    });
    await wrapper.findAll("circle.hit")[0].trigger("pointerenter");
    expect(wrapper.find(".chart-tooltip .tt-value").classes()).toContain("amount-value");
  });

  it("shows the empty message without hit areas when there is no data", () => {
    const wrapper = mount(LineChart, { props: { points: [] } });
    expect(wrapper.text()).toContain("データがありません");
    expect(wrapper.findAll("circle.hit")).toHaveLength(0);
  });
});
