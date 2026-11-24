import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { HEALTH_API_URL, useHealthStore } from "../../src/stores/health";
import { useHealthData } from "../../src/composables/useHealthData";

const payload = { body_composition: [] };
const activityPayload = { chat_activity: [] };
const okResponse = (json) => ({ ok: true, json: async () => json });

const Harness = defineComponent({
  props: { scope: { type: String, default: "full" } },
  setup(props) {
    useHealthData(props.scope);
    return () => h("div");
  },
});

describe("useHealthData scope routing", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("location", { hash: "" });
  });

  it("loads the activity scope for the activity page when empty", async () => {
    const fetchMock = vi.fn(async () => okResponse(activityPayload));
    vi.stubGlobal("fetch", fetchMock);
    mount(Harness, { props: { scope: "activity" } });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith(`${HEALTH_API_URL}?scope=activity`);
  });

  it("loads nothing for the activity page when data is already present", async () => {
    const fetchMock = vi.fn(async () => okResponse(activityPayload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.data = { chatActivity: [] };
    store.dataScope = "activity";
    mount(Harness, { props: { scope: "activity" } });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("upgrades an activity-scope store to the full payload for other pages", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.data = { chatActivity: [] };
    store.dataScope = "activity";
    mount(Harness, { props: { scope: "full" } });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_API_URL);
  });

  it("loads nothing for other pages when data is present without a scope upgrade need", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.data = { bodyComposition: [] };
    store.dataScope = "full";
    mount(Harness, { props: { scope: "full" } });
    await Promise.resolve();
    store.dataScope = "";
    mount(Harness, { props: { scope: "full" } });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads nothing while a fetch is in flight", async () => {
    const fetchMock = vi.fn(async () => okResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const store = useHealthStore();
    store.loading = true;
    mount(Harness, { props: { scope: "full" } });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
