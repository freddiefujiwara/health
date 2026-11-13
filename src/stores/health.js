import { defineStore } from "pinia";
import { normalizeHealth } from "@/domain/normalize";
import { parseShareToken } from "@/domain/share";

// The API endpoint can be overridden at build time (staging builds set
// VITE_GAS_ENDPOINT to the staging deployment). Production builds leave
// it unset and use the production endpoint below.
export const HEALTH_API_URL =
  import.meta.env.VITE_GAS_ENDPOINT ??
  "https://script.google.com/macros/s/AKfycbxGka-swbhzKbZsVUVzCbIpFHkkBf1Wr8DDsyBsHJtWhZv0LLWjlMqOSQbHHP2Cc3-O/exec";
const PAYLOAD_CACHE_STORAGE_KEY = "health-payload-cache-v1";
// A cached payload younger than this is used as-is; an older one is shown
// immediately and refreshed in the background (stale-while-revalidate).
const PAYLOAD_CACHE_FRESH_MS = 60 * 1000;
// Never resurrect a payload older than this, even from a long-lived tab.
const PAYLOAD_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function readPayloadCache(mode) {
  try {
    const raw = globalThis.sessionStorage?.getItem(PAYLOAD_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.mode !== mode || !parsed.payload) {
      return null;
    }
    if (Date.now() - parsed.savedAt > PAYLOAD_CACHE_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePayloadCache(mode, payload) {
  try {
    globalThis.sessionStorage?.setItem(
      PAYLOAD_CACHE_STORAGE_KEY,
      JSON.stringify({ mode, savedAt: Date.now(), payload }),
    );
  } catch {
    // Storage may be unavailable or full; caching is best-effort.
  }
}

function clearPayloadCache() {
  try {
    globalThis.sessionStorage?.removeItem(PAYLOAD_CACHE_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

const SESSION_TOKEN_STORAGE_KEY = "health-session-token";
const LEGACY_ID_TOKEN_STORAGE_KEY = "health-google-id-token";
const SHARE_TOKEN_STORAGE_KEY = "health-share-token";

// Sign-in uses a 30-day owner session issued by the API in exchange for
// the (1-hour) Google ID token; the raw ID token is never stored.
function getSessionToken() {
  return globalThis.localStorage?.getItem(SESSION_TOKEN_STORAGE_KEY) ?? "";
}

function setSessionToken(token) {
  if (token) {
    globalThis.localStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  } else {
    globalThis.localStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }
}

function clearLegacyIdToken() {
  globalThis.localStorage?.removeItem(LEGACY_ID_TOKEN_STORAGE_KEY);
}

function getShareToken() {
  const fromHash = parseShareToken(globalThis.location?.hash ?? "");
  if (fromHash) {
    globalThis.sessionStorage?.setItem(SHARE_TOKEN_STORAGE_KEY, fromHash);
    return fromHash;
  }
  return globalThis.sessionStorage?.getItem(SHARE_TOKEN_STORAGE_KEY) ?? "";
}

function buildApiUrlWithSession(sessionToken) {
  const url = new URL(HEALTH_API_URL);
  url.searchParams.set("session_token", sessionToken);
  return url.toString();
}

function buildApiUrlWithShare(shareToken) {
  const url = new URL(HEALTH_API_URL);
  url.searchParams.set("share_token", shareToken);
  return url.toString();
}

function buildActionUrl(action, { idToken = "", sessionToken = "" } = {}) {
  const url = new URL(HEALTH_API_URL);
  url.searchParams.set("action", action);
  if (idToken) {
    url.searchParams.set("id_token", idToken);
  }
  if (sessionToken) {
    url.searchParams.set("session_token", sessionToken);
  }
  return url.toString();
}

export const useHealthStore = defineStore("health", {
  state: () => ({
    data: null,
    loading: false,
    error: "",
    source: "",
    rawResponse: null,
    shareMode: false,
    shareExpiresAt: "",
    hasSession: false,
    issuedShare: null,
  }),
  actions: {
    async fetchHealth() {
      if (this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";
      clearLegacyIdToken();
      const sessionToken = getSessionToken();
      const shareToken = sessionToken ? "" : getShareToken();
      this.shareMode = Boolean(shareToken);
      this.hasSession = Boolean(sessionToken);
      const apiUrl = sessionToken
        ? buildApiUrlWithSession(sessionToken)
        : shareToken
          ? buildApiUrlWithShare(shareToken)
          : HEALTH_API_URL;
      const cacheMode = sessionToken ? "session" : shareToken ? "share" : "google";
      const cached = readPayloadCache(cacheMode);
      if (cached) {
        this.rawResponse = cached.payload;
        this.shareExpiresAt = cached.payload?._share?.expires_at ?? "";
        this.data = normalizeHealth(cached.payload);
        this.source = "live";
        if (Date.now() - cached.savedAt < PAYLOAD_CACHE_FRESH_MS) {
          this.loading = false;
          return;
        }
        // Stale cache: keep it on screen (loading stays off) and refresh
        // in the background via the normal request below.
        this.loading = false;
      }
      try {
        while (true) {
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const json = await response.json();
          if (json && (json.status === 401 || json.status === 403)) {
            const authMessage = json.error ?? "unauthorized";
            if (sessionToken && authMessage === "session expired or invalid") {
              // The stored owner session is gone or expired; drop it so
              // the shell returns to the Google sign-in gate.
              setSessionToken("");
              this.hasSession = false;
            }

            throw new Error(`AUTH ${json.status}: ${authMessage}`);
          }

          this.rawResponse = json;
          this.shareExpiresAt = json?._share?.expires_at ?? "";
          this.data = normalizeHealth(json);
          this.source = "live";
          writePayloadCache(cacheMode, json);
          break;
        }
      } catch (error) {
        const message = error?.message ?? "unknown error";
        if (message.startsWith("AUTH ")) {
          clearPayloadCache();
          this.error = message;
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        if (cached && this.data) {
          // Background refresh failed; keep showing the cached payload.
          return;
        }

        if (shareToken) {
          // Never show sample data to a share-link viewer.
          this.error = message;
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        const isCorsError = message.toLowerCase().includes("failed to fetch");
        if (sessionToken && isCorsError) {
          this.error = "CORS blocked API request. Ensure GAS doGet returns Access-Control-Allow-Origin.";
          this.data = null;
          this.source = "";
          this.rawResponse = null;
          return;
        }

        // The sample payload is only a development fallback; load it on
        // demand so it stays out of the initial bundle.
        const { default: sampleApi } = await import("@/mocks/sampleApi.json");
        this.error = `${message} (fallback to mock)`;
        this.rawResponse = sampleApi;
        this.data = normalizeHealth(sampleApi);
        this.source = "mock";
      } finally {
        this.loading = false;
      }
    },

    // Exchange a fresh Google ID token for a 30-day owner session and
    // store it. Returns the session token, or "" when the exchange was
    // rejected (the error is surfaced via this.error like other AUTH
    // failures).
    async exchangeSession(idToken) {
      const response = await fetch(buildActionUrl("exchange_session", { idToken }));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        this.error = `AUTH ${json.status}: ${json.error ?? "unauthorized"}`;
        return "";
      }
      if (!json?.session_token) {
        return "";
      }
      setSessionToken(json.session_token);
      this.hasSession = true;
      return json.session_token;
    },

    // Revoke the stored owner session (logout). Best effort: the local
    // copy is dropped even when the API call fails.
    async revokeSession() {
      const sessionToken = getSessionToken();
      clearPayloadCache();
      setSessionToken("");
      this.hasSession = false;
      if (!sessionToken) {
        return;
      }
      try {
        await fetch(buildActionUrl("revoke_session", { sessionToken }));
      } catch {
        // Logout must not fail on a network error.
      }
    },

    async issueShare() {
      const response = await fetch(
        buildActionUrl("issue_share", { sessionToken: getSessionToken() }),
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
      }
      this.issuedShare = { token: json.share_token, expiresAt: json.expires_at };
      return this.issuedShare;
    },

    async revokeShare() {
      const response = await fetch(
        buildActionUrl("revoke_share", { sessionToken: getSessionToken() }),
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.status === 401 || json.status === 403)) {
        throw new Error(`AUTH ${json.status}: ${json.error ?? "unauthorized"}`);
      }
      this.issuedShare = null;
    },
  },
});
