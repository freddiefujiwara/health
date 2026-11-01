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

  it("sends the stored ID token as a query parameter", async () => {
    localStorage.setItem("health-google-id-token", "stored-token");
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?id_token=stored-token`);
    expect(store.source).toBe("live");
  });

  it("prefers a direct token over the stored one", async () => {
    localStorage.setItem("health-google-id-token", "stored-token");
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth("direct-token");
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?id_token=direct-token`);
  });

  it("reports an AUTH error without falling back when the token is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 401, error: "missing id token" })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.error).toBe("AUTH 401: missing id token (GAS must read e.parameter.id_token)");
    expect(store.data).toBeNull();
    expect(store.source).toBe("");
    expect(store.rawResponse).toBeNull();
  });

  it("retries once when the API reports a missing ID token despite having one", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => okResponse({ status: 401, error: "missing id token" }))
      .mockImplementationOnce(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth("some-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.source).toBe("live");
  });

  it("gives up after one retry when the ID token keeps being reported missing", async () => {
    const fetchMock = vi.fn(async () => okResponse({ status: 401, error: "missing id token" }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    await store.fetchHealth("some-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.error).toBe("AUTH 401: missing id token (GAS must read e.parameter.id_token)");
    expect(store.data).toBeNull();
  });

  it("reports an AUTH error for a forbidden email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ status: 403, error: "forbidden email" })));
    const store = useHealthStore();
    await store.fetchHealth("some-token");
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
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const store = useHealthStore();
    await store.fetchHealth("some-token");
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
    await store.fetchHealth("some-token");
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

  it("issues a share session with the stored ID token", async () => {
    localStorage.setItem("health-google-id-token", "owner-token");
    const fetchMock = vi.fn(async () => okResponse({
      share_token: "new-share-token",
      expires_at: "2026-10-31T05:00:00.000Z",
      ttl_seconds: 1800,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    const issued = await store.issueShare();
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=issue_share&id_token=owner-token`,
    );
    expect(issued).toEqual({ token: "new-share-token", expiresAt: "2026-10-31T05:00:00.000Z" });
    expect(store.issuedShare).toEqual(issued);
  });

  it("issues a share session without a stored ID token", async () => {
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
    localStorage.setItem("health-google-id-token", "owner-token");
    const fetchMock = vi.fn(async () => okResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.issuedShare = { token: "tok", expiresAt: "2026-10-31T05:00:00.000Z" };
    await store.revokeShare();
    expect(fetchMock).toHaveBeenCalledWith(
      `${HEALTH_API_URL}?action=revoke_share&id_token=owner-token`,
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
