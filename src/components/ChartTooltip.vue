<script setup>
defineProps({
  // { left, top, below, dateText, valueText } or null when hidden.
  tooltip: { type: Object, default: null },
  // Mask the value while privacy mode hides the axis values.
  maskValue: { type: Boolean, default: false },
});
</script>

<template>
  <div
    v-if="tooltip"
    class="chart-tooltip"
    :class="{ below: tooltip.below }"
    :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
  >
    <span class="tt-date">{{ tooltip.dateText }}</span>
    <span class="tt-value" :class="{ 'amount-value': maskValue }">{{ tooltip.valueText }}</span>
  </div>
</template>

<style scoped>
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
