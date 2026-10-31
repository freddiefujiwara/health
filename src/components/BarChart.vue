<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";

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
let resizeObserver = null;

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

  svg
    .selectAll("rect.bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.date))
    .attr("width", x.bandwidth())
    .attr("y", (d) => (props.signed ? Math.min(y(d.value), y(0)) : y(d.value)))
    .attr("height", (d) => (props.signed ? Math.abs(y(d.value) - y(0)) : y(0) - y(d.value)))
    .attr("fill", (d) => (props.signed && d.value < 0 ? props.negativeColor : props.color))
    .append("title")
    .text((d) => `${d.date}: ${d.value}${props.unit}`);
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
  <div ref="root" class="bar-chart"></div>
</template>

<style scoped>
.bar-chart {
  width: 100%;
}
</style>
