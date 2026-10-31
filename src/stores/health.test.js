import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useHealthStore } from "./health";

const payload = {
  body_composition: [{ date: "2026-07-25", measurement_type: "TANITA", weight_kg: 99.7 }],
  goals_settings: [{ item: "最終目標", value: 80 }],
};

describe("health store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it("fetches live data and normalizes it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    })));
    const store = useHealthStore();
    await store.fetchHealth();
    expect(store.source).toBe("live");
    expect(store.error).toBe("");
    expect(store.loading).toBe(false);
    expect(store.data.bodyComposition[0].weightKg).toBe(99.7);
    expect(store.data.goals.finalGoalKg).toBe(80);
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
