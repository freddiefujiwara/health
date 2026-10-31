import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useHealthStore } from "@/stores/health";

/**
 * Connect to the health store and fetch data on mount.
 */
export function useHealthData() {
  const store = useHealthStore();
  const { data, loading, error, source, rawResponse } = storeToRefs(store);

  onMounted(() => {
    if (!data.value && !loading.value && !error.value) {
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
