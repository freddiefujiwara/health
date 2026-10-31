import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { HEALTH_API_URL, useHealthStore } from "./health";

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
});
