import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { HEALTH_API_URL, useHealthStore } from "../../src/stores/health";

const payload = {
  body_composition: [{ date: "2026-07-25", measurement_type: "TANITA", weight_kg: 99.7 }],
  goals_settings: [{ item: "最終目標", value: 80 }],
};

const okResponse = (json) => ({
  ok: true,
  json: async () => json,
});

describe("health store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("location", { hash: "" });
  });

  it("fetches live data and normalizes it", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_API_URL);
    expect(store.source).toBe("live");
    expect(store.error).toBe("");
    expect(store.loading).toBe(false);
    expect(store.data.bodyComposition[0].weightKg).toBe(99.7);
    expect(store.data.goals.finalGoalKg).toBe(80);
  });

  it("sends the stored session token as a query parameter", async () => {
    localStorage.setItem("health-session-token", "stored-session");
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?session_token=stored-session`);
    expect(store.source).toBe("live");
    expect(store.hasSession).toBe(true);
  });

  it("exchanges a Google ID token for a stored owner session", async () => {
    const fetchMock = vi.fn(async () => okResponse({
      session_token: "new-session",
      expires_at: "2026-12-31T05:00:00.000Z",
      ttl_seconds: 2592000,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    const token = await store.exchangeSession("google-id-token");
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=exchange_session&id_token=google-id-token`,
    );
    expect(token).toBe("new-session");
    expect(localStorage.getItem("health-session-token")).toBe("new-session");
    expect(store.hasSession).toBe(true);
  });

  it("does not store a session when the exchange is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 403, error: "forbidden email" })));
    const store = useHealthStore();
    const token = await store.exchangeSession("google-id-token");
    expect(token).toBe("");
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.error).toBe("AUTH 403: forbidden email");
  });

  it("reports an AUTH error without falling back when the token is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401, error: "missing id token" })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 401: missing id token");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
    expect(store.rawResponse).toBeNull();
  });

  it("clears the stored session when the API reports it expired or invalid", async () => {
    localStorage.setItem("health-session-token", "stale-session");
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({
      status: 401,
      error: "session expired or invalid",
    })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 401: session expired or invalid");
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.hasSession).toBe(false);
    expect(store.data).toBeNull();
  });

  it("revokes the owner session and clears the stored token", async () => {
    localStorage.setItem("health-session-token", "live-session");
    const fetchMock = vi.fn(async () => okResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.revokeSession();
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=revoke_session&session_token=live-session`,
    );
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.hasSession).toBe(false);
  });

  it("throws when the session exchange returns an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const store = useHealthStore();
    await expect(store.exchangeSession("google-id-token")).rejects.toThrow("HTTP 500");
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.hasSession).toBe(false);
  });

  it("returns an empty token when the exchange response has no session token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ expires_at: "2026-12-31T05:00:00.000Z" })));
    const store = useHealthStore();
    const token = await store.exchangeSession("google-id-token");
    expect(token).toBe("");
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.hasSession).toBe(false);
  });

  it("uses a generic message when the exchange rejection has no error detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401 })));
    const store = useHealthStore();
    const token = await store.exchangeSession("google-id-token");
    expect(token).toBe("");
    expect(store.error).toBe("AUTH 401: unauthorized");
    expect(localStorage.getItem("health-session-token")).toBeNull();
  });

  it("revokeSession does not call the API when no session is stored", async () => {
    const fetchMock = vi.fn(async () => okResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.revokeSession();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.hasSession).toBe(false);
  });

  it("revokeSession still clears the local session when the API call fails", async () => {
    localStorage.setItem("health-session-token", "live-session");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const store = useHealthStore();
    await expect(store.revokeSession()).resolves.toBeUndefined();
    expect(localStorage.getItem("health-session-token")).toBeNull();
    expect(store.hasSession).toBe(false);
  });

  it("reports an AUTH error for a forbidden email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 403, error: "forbidden email" })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 403: forbidden email");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
  });

  it("uses a generic auth message when the API error has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401 })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 401: unauthorized");
    expect(store.data).toBeNull();
  });

  it("reports a CORS error without falling back when a token was sent", async () => {
    localStorage.setItem("health-session-token", "stored-session");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toContain("CORS blocked API request");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
  });

  it("falls back to the bundled sample when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.source).toBe("mock");
    expect(store.error).toContain("HTTP 500");
    expect(store.data).not.toBeNull();
  });

  it("falls back even with a token when the failure is not a CORS error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.source).toBe("mock");
    expect(store.error).toContain("HTTP 500");
  });

  it("falls back with a generic message for non-Error rejections", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw "network down";
    }));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.source).toBe("mock");
    expect(store.error).toContain("unknown error");
  });

  it("does nothing while a fetch is already in flight", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.loading = true;
    await store.fetchHealth();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches with a share token from the URL hash and stores it for the tab", async () => {
    vi.stubGlobal("location", { hash: "#share=share-token-1" });
    const sharePayload = {
      ...payload,
      _share: { expires_at: "2026-10-31T05:00:00.000Z" },
    };
    const fetchMock = vi.fn(async () => okResponse(sharePayload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?share_token=share-token-1`);
    expect(sessionStorage.getItem("health-share-token")).toBe("share-token-1");
    expect(store.shareMode).toBe(true);
    expect(store.shareExpiresAt).toBe("2026-10-31T05:00:00.000Z");
    expect(store.source).toBe("live");
  });

  it("fetches with a share token kept in session storage", async () => {
    sessionStorage.setItem("health-share-token", "share-token-2");
    const fetchMock = vi.fn(async () => okResponse({ ...payload, _share: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?share_token=share-token-2`);
    expect(store.shareMode).toBe(true);
    expect(store.shareExpiresAt).toBe("");
  });

  it("reports an AUTH error for an expired share session", async () => {
    sessionStorage.setItem("health-share-token", "share-token-3");
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({
      status: 401,
      error: "share session expired or invalid",
    })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 401: share session expired or invalid");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
  });

  it("never falls back to sample data in share mode", async () => {
    sessionStorage.setItem("health-share-token", "share-token-4");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("Failed to fetch");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
  });

  it("issues a share session with the stored owner session", async () => {
    localStorage.setItem("health-session-token", "owner-token");
    const fetchMock = vi.fn(async () => okResponse({
      share_token: "new-share-token",
      expires_at: "2026-10-31T05:00:00.000Z",
      ttl_seconds: 1800,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    const issued = await store.issueShare();
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=issue_share&session_token=owner-token`,
    );
    expect(issued).toEqual({ token: "new-share-token", expiresAt: "2026-10-31T05:00:00.000Z" });
    expect(store.issuedShare).toEqual(issued);
  });

  it("issues a share session without a stored owner session", async () => {
    const fetchMock = vi.fn(async () => okResponse({
      share_token: "tok",
      expires_at: "2026-10-31T05:00:00.000Z",
    }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.issueShare();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?action=issue_share`);
  });

  it("throws when issuing is rejected by the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 403, error: "forbidden email" })));
    const store = useHealthStore();
    await expect(store.issueShare()).rejects.toThrow("AUTH 403: forbidden email");
    expect(store.issuedShare).toBeNull();
  });

  it("throws a generic AUTH error when the issue response has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401 })));
    const store = useHealthStore();
    await expect(store.issueShare()).rejects.toThrow("AUTH 401: unauthorized");
  });

  it("throws on an HTTP error while issuing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })));
    const store = useHealthStore();
    await expect(store.issueShare()).rejects.toThrow("HTTP 500");
  });

  it("revokes the issued share session", async () => {
    localStorage.setItem("health-session-token", "owner-token");
    const fetchMock = vi.fn(async () => okResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.issuedShare = { token: "tok", expiresAt: "2026-10-31T05:00:00.000Z" };
    await store.revokeShare();
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=revoke_share&session_token=owner-token`,
    );
    expect(store.issuedShare).toBeNull();
  });

  it("throws when revoking is rejected by the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401, error: "token expired" })));
    const store = useHealthStore();
    await expect(store.revokeShare()).rejects.toThrow("AUTH 401: token expired");
  });

  it("throws a generic AUTH error when the revoke response has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 403 })));
    const store = useHealthStore();
    await expect(store.revokeShare()).rejects.toThrow("AUTH 403: unauthorized");
  });

  it("works when location has no hash property", async () => {
    vi.stubGlobal("location", {});
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_API_URL);
    expect(store.source).toBe("live");
  });

  it("works when location itself is unavailable", async () => {
    vi.stubGlobal("location", undefined);
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_API_URL);
    expect(store.source).toBe("live");
  });

  it("throws on an HTTP error while revoking", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })));
    const store = useHealthStore();
    await expect(store.revokeShare()).rejects.toThrow("HTTP 503");
  });
});

describe("health store payload cache", () => {
  const cacheKey = "health-payload-cache-v1";
  const seedCache = (savedAt, body) =>
    sessionStorage.setItem(cacheKey, JSON.stringify({ mode: "google", savedAt, payload: body }));

  it("serves a fresh cached payload without fetching", async () => {
    seedCache(Date.now(), payload);
    const fetchMock = vi.fn(async () => okResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.source).toBe("live");
    expect(store.data.bodyComposition[0].weightKg).toBe(99.7);
  });

  it("shows a stale cached payload and refreshes it from the API", async () => {
    seedCache(Date.now() - 120_000, payload);
    const fresh = {
      body_composition: [{ date: "2026-11-12", measurement_type: "TANITA", weight_kg: 88.5 }],
      goals_settings: [{ item: "最終目標", value: 80 }],
    };
    const fetchMock = vi.fn(async () => okResponse(fresh));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.data.bodyComposition[0].weightKg).toBe(88.5);
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    expect(cached.payload.body_composition[0].weight_kg).toBe(88.5);
  });

  it("clears cache and data when the refresh hits an auth error", async () => {
    seedCache(Date.now() - 120_000, payload);
    const fetchMock = vi.fn(async () => okResponse({ status: 401, error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.data).toBeNull();
    expect(store.error).toContain("AUTH 401");
    expect(sessionStorage.getItem(cacheKey)).toBeNull();
  });

  it("writes the fetched payload to the cache", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    expect(cached.mode).toBe("google");
    expect(cached.payload.body_composition[0].weight_kg).toBe(99.7);
  });
});

describe("health store payload cache edge cases", () => {
  const cacheKey = "health-payload-cache-v1";

  it("ignores a cache entry stored for a different auth mode", async () => {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ mode: "share", savedAt: Date.now(), payload }),
    );
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores cache entries without a payload or with malformed JSON", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    sessionStorage.setItem(cacheKey, JSON.stringify({ mode: "google", savedAt: Date.now() }));
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    sessionStorage.setItem(cacheKey, "null");
    store.data = null;
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    sessionStorage.setItem(cacheKey, "{broken");
    store.data = null;
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignores a cache entry older than the maximum age", async () => {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ mode: "google", savedAt: Date.now() - 13 * 60 * 60 * 1000, payload }),
    );
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps showing the stale cache when the background refresh fails", async () => {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ mode: "google", savedAt: Date.now() - 120_000, payload }),
    );
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.data.bodyComposition[0].weightKg).toBe(99.7);
    expect(store.error).toBe("");
    expect(store.source).toBe("live");
  });

  it("tolerates storage failures when writing and clearing the cache", async () => {
    const realSession = globalThis.sessionStorage;
    vi.stubGlobal("sessionStorage", {
      getItem: (key) => realSession.getItem(key),
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {
        throw new Error("storage unavailable");
      },
    });
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.source).toBe("live");
    await store.revokeSession();
    vi.stubGlobal("sessionStorage", realSession);
  });
});

describe("health store payload cache in share mode", () => {
  it("restores the share expiry from a fresh cached payload without fetching", async () => {
    vi.stubGlobal("location", { hash: `#share=${"a".repeat(64)}` });
    sessionStorage.setItem(
      "health-payload-cache-v1",
      JSON.stringify({
        mode: "share",
        savedAt: Date.now(),
        payload: { ...payload, _share: { expires_at: "2026-12-02T07:56:00.000Z" } },
      }),
    );
    const fetchMock = vi.fn(async () => okResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.shareMode).toBe(true);
    expect(store.shareExpiresAt).toBe("2026-12-02T07:56:00.000Z");
  });
});
