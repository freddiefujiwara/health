import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Track a chart element's width and re-run `render` whenever it changes.
 * Returns the template ref to attach and the current width.
 */
export function useChartResize(render) {
  const root = ref(null);
  const width = ref(320);
  let resizeObserver = null;

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

  return { root, width };
}
