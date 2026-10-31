import { defineStore } from "pinia";
import { normalizeHealth } from "@/domain/normalize";
import sampleApi from "@/mocks/sampleApi.json";

export const HEALTH_API_URL =
  "https://script.google.com/macros/s/AKfycbxGka-swbhzKbZsVUVzCbIpFHkkBf1Wr8DDsyBsHJtWhZv0LLWjlMqOSQbHHP2Cc3-O/exec";
const ID_TOKEN_STORAGE_KEY = "health-google-id-token";

function getGoogleIdToken() {
  return globalThis.localStorage?.getItem(ID_TOKEN_STORAGE_KEY) ?? "";
}

function buildApiUrlWithToken(idToken) {
  if (!idToken) {
    return HEALTH_API_URL;
  }

  const url = new URL(HEALTH_API_URL);
  url.searchParams.set("id_token", idToken);
  return url.toString();
}

export const useHealthStore = defineStore("health", {
  state: () => ({
    data: null,
    loading: false,
    error: "",
    source: "",
    rawResponse: null,
  }),
  actions: {
    async fetchHealth(directToken = null) {
      if (this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";
      const idToken = directToken || getGoogleIdToken();
      try {
        let didRetryMissingIdToken = false;
        while (true) {
          const response = await fetch(buildApiUrlWithToken(idToken));
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const json = await response.json();
          if (json && (json.status === 401 || json.status === 403)) {
            const authMessage = json.error ?? "unauthorized";
            if (
              authMessage === "missing id token"
              && idToken
              && !didRetryMissingIdToken
            ) {
              didRetryMissingIdToken = true;
              continue;
            }

            if (authMessage === "missing id token") {
              throw new Error("AUTH 401: missing id token (GAS must read e.parameter.id_token)");
            }

            throw new Error(`AUTH ${json.status}: ${authMessage}`);
          }

          this.rawResponse = json;
          this.data = normalizeHealth(json);
          this.source = "live";
          break;
        }
      } catch (error) {
        const message = error?.message ?? "unknown error";
        if (message.startsWith("AUTH ")) {
          this.error = message;
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        const isCorsError = message.toLowerCase().includes("failed to fetch");
        if (idToken && isCorsError) {
          this.error = "CORS blocked API request. Ensure GAS doGet returns Access-Control-Allow-Origin.";
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

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
