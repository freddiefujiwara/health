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

  it("renders plain labels as-is when labelType is plain", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: [
          { date: "0時", value: 10 },
          { date: "5時", value: 42 },
          { date: "13時", value: 30 },
          { date: "23時", value: 5 },
        ],
        labelType: "plain",
        unit: "件",
      },
    });
    expect(wrapper.findAll("rect.bar")).toHaveLength(4);
    expect(wrapper.text()).toContain("0時");
    expect(wrapper.text()).toContain("23時");
  });
});

describe("bar chart bands", () => {
  const hourPoints = Array.from({ length: 24 }, (_, h) => ({ date: `${h}時`, value: h === 5 ? 28 : 3 }));

  it("renders background bands behind the bars", () => {
    const wrapper = mount(BarChart, {
      props: { points: hourPoints, unit: "回", labelType: "plain", bands: [{ from: 0, to: 4.25 }, { from: 20.5, to: 24 }] },
    });
    const bands = wrapper.findAll("rect.band");
    expect(bands).toHaveLength(2);
    expect(Number(bands[0].attributes("width"))).toBeGreaterThan(0);
    expect(Number(bands[1].attributes("x"))).toBeGreaterThan(Number(bands[0].attributes("x")));
  });

  it("renders band labels on top of the bands", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: hourPoints,
        unit: "回",
        labelType: "plain",
        bands: [{ from: 0, to: 4.25, label: "5時間45分" }],
      },
    });
    const labels = wrapper.findAll("text.band-label");
    expect(labels).toHaveLength(1);
    expect(labels[0].text()).toBe("5時間45分");
  });

  it("renders no bands by default", () => {
    const wrapper = mount(BarChart, { props: { points: hourPoints, unit: "回", labelType: "plain" } });
    expect(wrapper.findAll("rect.band")).toHaveLength(0);
  });
});
