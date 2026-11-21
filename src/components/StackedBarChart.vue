<script setup>
import { computed, ref, watch } from "vue";
import * as d3 from "d3";
import { formatChartValue, formatDecimal } from "@/domain/format";
import ChartTooltip from "@/components/ChartTooltip.vue";
import { useChartResize } from "@/composables/useChartResize";

const props = defineProps({
  // [{ date: 'YYYY-MM-DD', totalKg, fatKg, muscleKg, otherKg }]
  points: { type: Array, required: true },
  unit: { type: String, default: "kg" },
  // [{ date, value }] drawn as a line on a secondary (right) axis
  linePoints: { type: Array, default: () => [] },
  lineUnit: { type: String, default: "%" },
  lineColor: { type: String, default: "#38bdf8" },
  hideAxisInPrivate: { type: Boolean, default: false },
  height: { type: Number, default: 220 },
});

const tooltip = ref(null);

// Bottom to top: fat, muscle, other (water / protein / bone).
const SEGMENTS = [
  { key: "fatKg", color: "#f59e0b", textColor: "#111827" },
  { key: "muscleKg", color: "#22c55e", textColor: "#052e16" },
  { key: "otherKg", color: "#64748b", textColor: "#f1f5f9" },
];

function showTooltip(datum, cx, cy) {
  tooltip.value = {
    left: cx,
    top: cy,
    below: cy < 76,
    dateText: datum.date.replaceAll("-", "/"),
    valueText:
      `${formatChartValue(datum.totalKg)}${props.unit}` +
      `（脂肪 ${formatDecimal(datum.fatKg)}・筋肉 ${formatDecimal(datum.muscleKg)}・その他 ${formatDecimal(datum.otherKg)}）`,
  };
}

function hideTooltip() {
  tooltip.value = null;
}

const validPoints = computed(() =>
  props.points.filter((p) => p && Number.isFinite(p.totalKg)),
);

function render() {
  const el = root.value;
  if (!el) {
    return;
  }
  hideTooltip();
  const w = Math.max(260, width.value);
  const h = props.height;
  const hasLine = props.linePoints.some((p) => p && Number.isFinite(p.value));
  const margin = { top: 20, right: hasLine ? 44 : 12, bottom: 24, left: 48 };
  d3.select(el).selectAll("*").remove();
  const svg = d3
    .select(el)
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .attr("role", "img");

  const data = validPoints.value;
  if (!data.length) {
    svg
      .append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("データがありません");
    return;
  }

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.date))
    .range([margin.left, w - margin.right])
    .padding(0.15);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.totalKg)])
    .nice()
    .range([h - margin.bottom, margin.top]);

  const tickDates =
    data.length <= 8
      ? data.map((d) => d.date)
      : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d) => d.date);
  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(tickDates)
        .tickFormat((d) => d.slice(5).replace("-", "/")),
    )
    .selectAll("text")
    .attr("fill", "#94a3b8");
  svg
    .append("g")
    .attr("class", props.hideAxisInPrivate ? "chart-y-axis" : null)
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .attr("fill", "#94a3b8");
  svg.selectAll(".domain, .tick line").attr("stroke", "#334155");

  for (const d of data) {
    let base = 0;
    for (const seg of SEGMENTS) {
      const value = d[seg.key];
      const yTop = y(base + value);
      const yBottom = y(base);
      svg
        .append("rect")
        .attr("class", `segment segment-${seg.key}`)
        .attr("x", x(d.date))
        .attr("width", x.bandwidth())
        .attr("y", yTop)
        .attr("height", Math.max(0, yBottom - yTop))
        .attr("fill", seg.color);
      if (yBottom - yTop >= 14) {
        svg
          .append("text")
          .attr("class", "amount-value segment-label")
          .attr("x", x(d.date) + 6)
          .attr("y", (yTop + yBottom) / 2 + 3)
          .attr("text-anchor", "start")
          .attr("fill", seg.textColor)
          .attr("font-size", 10)
          .style("pointer-events", "none")
          .text(formatDecimal(value));
      }
      base += value;
    }
    svg
      .append("text")
      .attr("class", "amount-value total-label")
      .attr("x", x(d.date) + x.bandwidth() / 2)
      .attr("y", y(d.totalKg) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .style("pointer-events", "none")
      .text(formatDecimal(d.totalKg));
  }

  if (hasLine) {
    const lineData = props.linePoints.filter(
      (p) => p && Number.isFinite(p.value) && x(p.date) !== undefined,
    );
    const yRight = d3
      .scaleLinear()
      .domain(d3.extent(lineData, (d) => d.value))
      .nice()
      .range([h - margin.bottom, margin.top]);
    svg
      .append("g")
      .attr("transform", `translate(${w - margin.right},0)`)
      .call(d3.axisRight(yRight).ticks(5).tickFormat((v) => `${v}${props.lineUnit}`))
      .selectAll("text")
      .attr("fill", "#94a3b8");
    svg.selectAll(".domain, .tick line").attr("stroke", "#334155");
    const line = d3
      .line()
      .x((d) => x(d.date) + x.bandwidth() / 2)
      .y((d) => yRight(d.value));
    svg
      .append("path")
      .datum(lineData)
      .attr("class", "line-halo")
      .attr("fill", "none")
      .attr("stroke", "#0b1120")
      .attr("stroke-width", 5)
      .attr("opacity", 0.55)
      .attr("d", line);
    svg
      .append("path")
      .datum(lineData)
      .attr("class", "line-overlay")
      .attr("fill", "none")
      .attr("stroke", props.lineColor)
      .attr("stroke-width", 2)
      .attr("d", line);
    svg
      .selectAll("circle.line-dot")
      .data(lineData)
      .join("circle")
      .attr("class", "line-dot")
      .attr("cx", (d) => x(d.date) + x.bandwidth() / 2)
      .attr("cy", (d) => yRight(d.value))
      .attr("r", 3.5)
      .attr("fill", props.lineColor)
      .attr("stroke", "#0b1120")
      .attr("stroke-width", 1.5)
      .style("pointer-events", "none");
    svg
      .selectAll("text.line-value")
      .data(lineData)
      .join("text")
      .attr("class", "line-value")
      .attr("x", (d) => x(d.date) + x.bandwidth() / 2)
      .attr("y", (d) => yRight(d.value) - 9)
      .attr("text-anchor", "middle")
      .attr("fill", props.lineColor)
      .attr("font-size", 10.5)
      .attr("font-weight", 600)
      .style("paint-order", "stroke")
      .style("stroke", "#0b1120")
      .style("stroke-width", "3px")
      .style("pointer-events", "none")
      .text((d) => `${formatDecimal(d.value)}${props.lineUnit}`);
  }

  svg
    .selectAll("rect.hit")
    .data(data)
    .join("rect")
    .attr("class", "hit")
    .attr("x", (d) => x(d.date))
    .attr("width", x.bandwidth())
    .attr("y", margin.top)
    .attr("height", h - margin.bottom - margin.top)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("pointerenter pointerdown", (event, d) => {
      showTooltip(d, x(d.date) + x.bandwidth() / 2, y(d.totalKg));
    });

  svg.on("pointerleave", hideTooltip);
}

const { root, width } = useChartResize(render);

watch(() => [props.points, props.linePoints], () => render(), { deep: true });
</script>

<template>
  <div class="chart-wrap">
    <div ref="root" class="stacked-bar-chart"></div>
    <ChartTooltip :tooltip="tooltip" :mask-value="hideAxisInPrivate" />
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.stacked-bar-chart {
  width: 100%;
}
</style>
