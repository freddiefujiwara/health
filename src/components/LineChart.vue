<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { formatChartValue } from "@/domain/format";

const props = defineProps({
  // [{ date: 'YYYY-MM-DD', value: number|null }]
  points: { type: Array, required: true },
  color: { type: String, default: "#3b82f6" },
  unit: { type: String, default: "" },
  goalValue: { type: Number, default: null },
  projectionPoints: { type: Array, default: () => [] },
  projectionColor: { type: String, default: "#94a3b8" },
  hideAxisInPrivate: { type: Boolean, default: false },
  goalLabel: { type: String, default: "" },
  // [{ text } | { mask }] — masked parts render as .privacy-mask spans (HTML overlay).
  goalLabelParts: { type: Array, default: null },
  height: { type: Number, default: 220 },
});

const root = ref(null);
const width = ref(320);
const tooltip = ref(null);
const goalLabelPos = ref(null);
let resizeObserver = null;

function showTooltip(datum, cx, cy) {
  tooltip.value = {
    left: cx,
    top: cy,
    below: cy < 76,
    dateText: d3.timeFormat("%Y/%m/%d")(datum.date),
    valueText: `${formatChartValue(datum.value)}${props.unit}`,
  };
}

function hideTooltip() {
  tooltip.value = null;
}

const validPoints = computed(() =>
  props.points
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => ({ date: new Date(`${p.date}T00:00:00`), value: p.value })),
);

const validProjection = computed(() =>
  props.projectionPoints
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => ({ date: new Date(`${p.date}T00:00:00`), value: p.value })),
);

function render() {
  const el = root.value;
  if (!el) {
    return;
  }
  hideTooltip();
  goalLabelPos.value = null;
  const w = Math.max(260, width.value);
  const h = props.height;
  const margin = { top: 12, right: 12, bottom: 24, left: 44 };
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

  const values = data.map((d) => d.value).concat(validProjection.value.map((d) => d.value));
  if (props.goalValue !== null) {
    values.push(props.goalValue);
  }
  const x = d3
    .scaleTime()
    .domain(d3.extent(data.concat(validProjection.value), (d) => d.date))
    .range([margin.left, w - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([d3.min(values) * 0.98, d3.max(values) * 1.02])
    .nice()
    .range([h - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(
          d3.timeFormat(
            (x.domain()[1] - x.domain()[0]) / 86400000 > 550 ? "%Y" : "%m/%d",
          ),
        ),
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

  if (props.goalValue !== null) {
    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", w - margin.right)
      .attr("y1", y(props.goalValue))
      .attr("y2", y(props.goalValue))
      .attr("stroke", "#f59e0b")
      .attr("stroke-dasharray", "5 4");
    // The label is an HTML overlay (see template): SVG <text> cannot be
    // reliably blurred by CSS filter on iOS Safari, which broke masking.
    goalLabelPos.value = { left: w - margin.right, top: y(props.goalValue) };
  }

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value));
  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", props.color)
    .attr("stroke-width", 2)
    .attr("d", line);
  if (validProjection.value.length > 1) {
    svg
      .append("path")
      .datum(validProjection.value)
      .attr("fill", "none")
      .attr("stroke", props.projectionColor)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 4")
      .attr("d", line);
  }

  svg
    .selectAll("circle.point")
    .data(data)
    .join("circle")
    .attr("class", "point")
    .attr("cx", (d) => x(d.date))
    .attr("cy", (d) => y(d.value))
    .attr("r", 3.5)
    .attr("fill", props.color);

  const focus = svg
    .append("circle")
    .attr("class", "focus-ring")
    .attr("r", 7)
    .attr("fill", "none")
    .attr("stroke", "#e2e8f0")
    .attr("stroke-width", 2)
    .style("opacity", 0)
    .style("pointer-events", "none");

  svg
    .selectAll("circle.hit")
    .data(data)
    .join("circle")
    .attr("class", "hit")
    .attr("cx", (d) => x(d.date))
    .attr("cy", (d) => y(d.value))
    .attr("r", 16)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("pointerenter pointerdown", (event, d) => {
      focus.attr("cx", x(d.date)).attr("cy", y(d.value)).style("opacity", 1);
      showTooltip(d, x(d.date), y(d.value));
    });

  svg.on("pointerleave", () => {
    focus.style("opacity", 0);
    hideTooltip();
  });
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
  () => [props.points, props.projectionPoints, props.goalValue, props.color],
  () => render(),
  { deep: true },
);
</script>

<template>
  <div class="chart-wrap">
    <div ref="root" class="line-chart"></div>
    <div
      v-if="goalLabelPos && (goalLabelParts || goalLabel)"
      class="goal-label"
      :style="{ left: `${goalLabelPos.left}px`, top: `${goalLabelPos.top}px` }"
    >
      <template v-if="goalLabelParts">
        <template v-for="(part, i) in goalLabelParts" :key="i"><span v-if="typeof part === 'object'" class="privacy-mask">{{ part.mask }}</span><template v-else>{{ part }}</template></template>
      </template>
      <template v-else>{{ goalLabel }}</template>
    </div>
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

.line-chart {
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

.goal-label {
  position: absolute;
  transform: translate(-100%, -140%);
  color: #f59e0b;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
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
