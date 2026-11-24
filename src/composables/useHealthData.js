import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useHealthStore } from "@/stores/health";

/**
 * Connect to the health store and fetch data on mount.
 */
export function useHealthData(scope = "full") {
  const store = useHealthStore();
  const { data, loading, error, source, rawResponse } = storeToRefs(store);

  onMounted(() => {
    if (loading.value || error.value) {
      return;
    }
    if (scope === "activity") {
      // The activity page loads its own smaller payload; full data
      // already covers it.
      if (!data.value) {
        store.fetchActivity();
      }
    } else if (!data.value || store.dataScope === "activity") {
      // Other pages need the full payload: fetch when there is no data
      // yet, and upgrade an activity-scope store on arrival.
      store.fetchHealth();
    }
  });

  return {
    store,
    data,
    loading,
    error,
    source,
    rawResponse,
  };
}
