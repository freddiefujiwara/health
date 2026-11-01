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

  it("renders the goal label as an HTML overlay with a masked number part", async () => {
    const wrapper = mount(LineChart, {
      props: {
        points,
        unit: "kg",
        goalValue: 80,
        goalLabelParts: ["最終目標 ", { mask: "80" }, "kg"],
      },
    });
    await wrapper.vm.$nextTick();
    const label = wrapper.find(".goal-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("最終目標 80kg");
    expect(label.find(".privacy-mask").text()).toBe("80");
    // No SVG text may carry the goal value (CSS blur does not apply to SVG text on iOS Safari).
    expect(wrapper.find("svg text.amount-value").exists()).toBe(false);
  });

  it("falls back to the plain goalLabel string when no parts are given", async () => {
    const wrapper = mount(LineChart, {
      props: { points, unit: "kg", goalValue: 80, goalLabel: "最終目標 80kg" },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".goal-label").text()).toBe("最終目標 80kg");
    expect(wrapper.find(".goal-label .privacy-mask").exists()).toBe(false);
  });

  it("shows the empty message without hit areas when there is no data", () => {
    const wrapper = mount(LineChart, { props: { points: [] } });
    expect(wrapper.text()).toContain("データがありません");
    expect(wrapper.findAll("circle.hit")).toHaveLength(0);
  });
});
