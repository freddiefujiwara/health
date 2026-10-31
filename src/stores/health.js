import { defineStore } from "pinia";
import { normalizeHealth } from "@/domain/normalize";
import sampleApi from "@/mocks/sampleApi.json";

export const HEALTH_API_URL =
  "https://script.google.com/macros/s/AKfycbxGka-swbhzKbZsVUVzCbIpFHkkBf1Wr8DDsyBsHJtWhZv0LLWjlMqOSQbHHP2Cc3-O/exec";

export const useHealthStore = defineStore("health", {
  state: () => ({
    data: null,
    loading: false,
    error: "",
    source: "",
    rawResponse: null,
  }),
  actions: {
    async fetchHealth() {
      if (this.loading) {
        return;
      }
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch(HEALTH_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        this.rawResponse = json;
        this.data = normalizeHealth(json);
        this.source = "live";
      } catch (error) {
        const message = error?.message ?? "unknown error";
        this.error = `${message} (fallback to mock)`;
        this.rawResponse = sampleApi;
        this.data = normalizeHealth(sampleApi);
        this.source = "mock";
      } finally {
        this.loading = false;
      }
    },
  },
});
