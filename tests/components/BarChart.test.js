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

  it("uses a band's own color when one is given", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: hourPoints,
        unit: "回",
        labelType: "plain",
        bands: [{ from: 0, to: 4.25, color: "#38bdf8" }, { from: 20.5, to: 24 }],
      },
    });
    const bands = wrapper.findAll("rect.band");
    expect(bands[0].attributes("fill")).toBe("#38bdf8");
    expect(bands[1].attributes("fill")).toBe("#8b5cf6");
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

  it("staggers labels of neighbouring bands onto different rows", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: hourPoints,
        unit: "回",
        labelType: "plain",
        bands: [
          { from: 6, to: 7, label: "3時間46分" },
          { from: 7, to: 8, label: "5時間20分" },
        ],
      },
    });
    const labels = wrapper.findAll("text.band-label");
    expect(labels).toHaveLength(2);
    expect(labels[0].attributes("y")).not.toBe(labels[1].attributes("y"));
  });

  it("drops a label that fits on no row instead of overlapping", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: hourPoints,
        unit: "回",
        labelType: "plain",
        bands: [
          { from: 6, to: 7, label: "3時間46分" },
          { from: 6.2, to: 7.2, label: "5時間20分" },
          { from: 6.4, to: 7.4, label: "15時間39分" },
          { from: 6.6, to: 7.6, label: "9時間53分" },
        ],
      },
    });
    expect(wrapper.findAll("text.band-label").length).toBeLessThanOrEqual(3);
  });

  it("outlines band labels so they stay readable on light bands", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: hourPoints,
        unit: "回",
        labelType: "plain",
        bands: [{ from: 0, to: 4.25, label: "5時間45分" }],
      },
    });
    const label = wrapper.find("text.band-label");
    expect(label.attributes("stroke")).toBeTruthy();
    expect(label.attributes("style")).toContain("paint-order");
  });

  it("renders no bands by default", () => {
    const wrapper = mount(BarChart, { props: { points: hourPoints, unit: "回", labelType: "plain" } });
    expect(wrapper.findAll("rect.band")).toHaveLength(0);
  });
});

describe("bar chart scatter points and category labels", () => {
  it("draws one dot per scatter point over the bars", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: [
          { date: "土（注射日）", value: 2100 },
          { date: "月", value: 1700 },
        ],
        scatterPoints: [
          { date: "土（注射日）", value: 2000 },
          { date: "土（注射日）", value: 2200 },
          { date: "月", value: 1800 },
          { date: "月", value: null },
        ],
        unit: "kcal",
        labelType: "plain",
      },
    });
    expect(wrapper.findAll("circle.scatter")).toHaveLength(3);
  });

  it("shows every category label when there are only a few categories", () => {
    const wrapper = mount(BarChart, {
      props: {
        points: ["土（注射日）", "日", "月", "火", "水", "木", "金"].map((label) => ({ date: label, value: 2000 })),
        unit: "kcal",
        labelType: "plain",
      },
    });
    const text = wrapper.text();
    for (const label of ["土（注射日）", "日", "月", "火", "水", "木", "金"]) {
      expect(text).toContain(label);
    }
  });
});
