<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";

const props = defineProps({
  // [{ date: 'YYYY-MM-DD', value: number|null }]
  points: { type: Array, required: true },
  color: { type: String, default: "#3b82f6" },
  unit: { type: String, default: "" },
  goalValue: { type: Number, default: null },
  goalLabel: { type: String, default: "" },
  height: { type: Number, default: 220 },
});

const root = ref(null);
const width = ref(320);
let resizeObserver = null;

const validPoints = computed(() =>
  props.points
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => ({ date: new Date(`${p.date}T00:00:00`), value: p.value })),
);

function render() {
  const el = root.value;
  if (!el) {
    return;
  }
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

  const values = data.map((d) => d.value);
  if (props.goalValue !== null) {
    values.push(props.goalValue);
  }
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date))
    .range([margin.left, w - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([d3.min(values) * 0.98, d3.max(values) * 1.02])
    .nice()
    .range([h - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%m/%d")))
    .selectAll("text")
    .attr("fill", "#94a3b8");
  svg
    .append("g")
    .attr("class", "chart-y-axis")
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
    svg
      .append("text")
      .attr("x", w - margin.right)
      .attr("y", y(props.goalValue) - 5)
      .attr("text-anchor", "end")
      .attr("fill", "#f59e0b")
      .attr("font-size", 11)
      .text(props.goalLabel || `${props.goalValue}${props.unit}`);
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
  svg
    .selectAll("circle.point")
    .data(data)
    .join("circle")
    .attr("class", "point")
    .attr("cx", (d) => x(d.date))
    .attr("cy", (d) => y(d.value))
    .attr("r", 3.5)
    .attr("fill", props.color)
    .append("title")
    .text((d) => `${d3.timeFormat("%Y/%m/%d")(d.date)}: ${d.value}${props.unit}`);
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
  () => [props.points, props.goalValue, props.color],
  () => render(),
  { deep: true },
);
</script>

<template>
  <div ref="root" class="line-chart"></div>
</template>

<style scoped>
.line-chart {
  width: 100%;
}
</style>
