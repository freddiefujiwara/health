<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { formatChartValue } from "@/domain/format";

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
  height: { type: Number, default: 220 },
});

const root = ref(null);
const width = ref(320);
const tooltip = ref(null);
let resizeObserver = null;

function showTooltip(datum, cx, cy) {
  tooltip.value = {
    left: cx,
    top: cy,
    below: cy < 76,
    dateText: datum.date.replaceAll("-", "/"),
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
    props.guidelineValue ?? 0,
  );
  const y = d3
    .scaleLinear()
    .domain([minValue, maxValue])
    .nice()
    .range([h - margin.bottom, margin.top]);

  const tickDates = data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d) => d.date);
  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(tickDates).tickFormat((d) => d.slice(5).replace("-", "/")))
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

  svg.on("pointerleave", hideTooltip);
}

onMounted(() => {
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      width.value = entries[0].contentRect.width;
      render();
    });
    if (root.value) {
      resizeObserver.observe(root.value);
    }
  }
  render();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () => [props.points, props.guidelineValue],
  () => render(),
  { deep: true },
);
</script>

<template>
  <div class="chart-wrap">
    <div ref="root" class="bar-chart"></div>
    <div
      v-if="tooltip"
      class="chart-tooltip"
      :class="{ below: tooltip.below }"
      :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
    >
      <span class="tt-date">{{ tooltip.dateText }}</span>
      <span class="tt-value" :class="{ 'amount-value': hideAxisInPrivate }">{{ tooltip.valueText }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.bar-chart {
  width: 100%;
}

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  background: var(--surface-elevated, #1e293b);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.chart-tooltip.below {
  transform: translate(-50%, 14px);
}

.tt-date {
  display: block;
  color: var(--muted, #94a3b8);
}

.tt-value {
  display: block;
  font-weight: 700;
  font-size: 13px;
}
</style>
