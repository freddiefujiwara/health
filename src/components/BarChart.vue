<script setup>
import { computed, ref, watch } from "vue";
import * as d3 from "d3";
import { formatChartValue } from "@/domain/format";
import ChartTooltip from "@/components/ChartTooltip.vue";
import { useChartResize } from "@/composables/useChartResize";

const props = defineProps({
  // [{ date: 'YYYY-MM-DD', value: number|null }]
  points: { type: Array, required: true },
  color: { type: String, default: "#3b82f6" },
  negativeColor: { type: String, default: "#22c55e" },
  unit: { type: String, default: "" },
  guidelineValue: { type: Number, default: null },
  guidelineLabel: { type: String, default: "" },
  signed: { type: Boolean, default: false },
  hideAxisInPrivate: { type: Boolean, default: false },
  labelType: { type: String, default: "date" },
  // [{ from: number, to: number, label?: string }] in category-index units (e.g. hours 0..24); drawn behind the bars
  bands: { type: Array, default: () => [] },
  // [{ date: category, value }] individual observations drawn as dots over the bars
  scatterPoints: { type: Array, default: () => [] },
  height: { type: Number, default: 220 },
});

const tooltip = ref(null);

function showTooltip(datum, cx, cy) {
  tooltip.value = {
    left: cx,
    top: cy,
    below: cy < 76,
    dateText: props.labelType === "date" ? datum.date.replaceAll("-", "/") : datum.date,
    valueText: `${formatChartValue(datum.value)}${props.unit}`,
  };
}

function hideTooltip() {
  tooltip.value = null;
}

const validPoints = computed(() =>
  props.points
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => ({ date: p.date, value: p.value })),
);

function render() {
  const el = root.value;
  if (!el) {
    return;
  }
  hideTooltip();
  const w = Math.max(260, width.value);
  const h = props.height;
  const margin = { top: 12, right: 12, bottom: 24, left: 48 };
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
  const minValue = props.signed ? Math.min(0, d3.min(data, (d) => d.value)) : 0;
  const maxValue = Math.max(
    d3.max(data, (d) => d.value),
    d3.max(props.scatterPoints, (d) => d.value) ?? 0,
    props.guidelineValue ?? 0,
  );
  const y = d3
    .scaleLinear()
    .domain([minValue, maxValue])
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
        .tickFormat((d) => (props.labelType === "date" ? d.slice(5).replace("-", "/") : d)),
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

  if (props.signed) {
    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#64748b");
  }

  if (props.guidelineValue !== null) {
    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", y(props.guidelineValue))
      .attr("y2", y(props.guidelineValue))
      .attr("stroke", "#f59e0b")
      .attr("stroke-dasharray", "5 4");
    svg
      .append("text")
      .attr("x", w - margin.right)
      .attr("y", y(props.guidelineValue) - 5)
      .attr("text-anchor", "end")
      .attr("fill", "#f59e0b")
      .attr("font-size", 11)
      .text(props.guidelineLabel || `${props.guidelineValue}${props.unit}`);
  }

  let bandLayout = [];
  if (props.bands.length) {
    const slotStart = x(data[0].date) - (x.step() - x.bandwidth()) / 2;
    const plotRight = w - margin.right;
    bandLayout = props.bands.map((b) => {
      const bx = slotStart + b.from * x.step();
      const bw = Math.min((b.to - b.from) * x.step(), plotRight - bx);
      return { ...b, x: bx, width: bw };
    });
    svg
      .selectAll("rect.band")
      .data(bandLayout)
      .join("rect")
      .attr("class", "band")
      .attr("x", (b) => b.x)
      .attr("width", (b) => b.width)
      .attr("y", margin.top)
      .attr("height", h - margin.bottom - margin.top)
      .attr("fill", (b) => b.color || "#8b5cf6")
      .attr("opacity", 0.45);
  }

  const barTop = (d) => (props.signed ? Math.min(y(d.value), y(0)) : y(d.value));
  svg
    .selectAll("rect.bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.date))
    .attr("width", x.bandwidth())
    .attr("y", barTop)
    .attr("height", (d) => (props.signed ? Math.abs(y(d.value) - y(0)) : y(0) - y(d.value)))
    .attr("fill", (d) => (props.signed && d.value < 0 ? props.negativeColor : props.color));

  if (props.scatterPoints.length) {
    svg
      .selectAll("circle.scatter")
      .data(props.scatterPoints.filter((d) => d.value !== null && d.value !== undefined && x(d.date) !== undefined))
      .join("circle")
      .attr("class", "scatter")
      .attr("cx", (d) => x(d.date) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.value))
      .attr("r", 3)
      .attr("fill", "#e2e8f0")
      .attr("opacity", 0.6)
      .attr("pointer-events", "none");
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
      showTooltip(d, x(d.date) + x.bandwidth() / 2, barTop(d));
    });

  if (bandLayout.length) {
    const plotLeft = margin.left;
    const plotRight = w - margin.right;
    const estimateWidth = (text) =>
      [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 11 : 6.2), 0);
    // Every label used to sit on the same baseline, so labels of bands that
    // sit close together overlapped into an unreadable stack. Place each
    // label on the first of up to three staggered rows where it clears the
    // previous label on that row; a label that fits on no row is skipped
    // (the caption under the chart lists every band). A dark outline keeps
    // the near-white text readable on light band colors.
    const LABEL_ROWS = 3;
    const LABEL_GAP = 6;
    const rowRightEdges = [];
    const labelLayout = bandLayout
      .filter((b) => b.label)
      .map((b) => {
        const half = estimateWidth(b.label) / 2;
        const center = b.x + b.width / 2;
        const cx = Math.min(Math.max(center, plotLeft + half), plotRight - half);
        return { ...b, cx, left: cx - half, right: cx + half };
      })
      .sort((a, b) => a.cx - b.cx)
      .reduce((placed, item) => {
        for (let row = 0; row < LABEL_ROWS; row += 1) {
          if (rowRightEdges[row] === undefined || item.left >= rowRightEdges[row] + LABEL_GAP) {
            rowRightEdges[row] = item.right;
            placed.push({ ...item, row });
            return placed;
          }
        }
        return placed;
      }, []);
    svg
      .selectAll("text.band-label")
      .data(labelLayout)
      .join("text")
      .attr("class", "band-label")
      .attr("x", (b) => b.cx)
      .attr("y", (b) => margin.top + 14 + b.row * 16)
      .attr("text-anchor", "middle")
      .attr("fill", "#f8fafc")
      .attr("stroke", "rgba(2, 6, 23, 0.88)")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .style("paint-order", "stroke")
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .style("pointer-events", "none")
      .text((b) => b.label);
  }

  svg.on("pointerleave", hideTooltip);
}

const { root, width } = useChartResize(render);

watch(
  () => [props.points, props.guidelineValue, props.bands],
  () => render(),
  { deep: true },
);
</script>

<template>
  <div class="chart-wrap">
    <div ref="root" class="bar-chart"></div>
    <ChartTooltip :tooltip="tooltip" :mask-value="hideAxisInPrivate" />
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.bar-chart {
  width: 100%;
}

</style>
