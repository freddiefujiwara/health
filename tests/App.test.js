import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { useHealthStore } from "@/stores/health";
import { useUiStore } from "@/stores/ui";
import sampleApi from "@/mocks/sampleApi.json";
import { normalizeHealth } from "@/domain/normalize";

const stubView = { template: "<div>view-body</div>" };

function buildWrapper(setupStore, setupUi) {
  const pinia = createPinia();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/overview", component: stubView },
      { path: "/body", component: stubView },
      { path: "/nutrition", component: stubView },
      { path: "/steps", component: stubView },
      { path: "/labs", component: stubView },
    ],
  });
  const store = useHealthStore(pinia);
  if (setupStore) {
    setupStore(store);
  }
  if (setupUi) {
    setupUi(useUiStore(pinia));
  }
  const wrapper = mount(App, { global: { plugins: [pinia, router] } });
  return { wrapper, store, router };
}

describe("app shell", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the Google login gate when there is no data and an AUTH error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 401, error: "missing id token" }),
    })));
    const { wrapper } = buildWrapper();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Googleログインが必要です");
    expect(wrapper.text()).toContain("許可されたアカウントでサインインしてください");
    expect(wrapper.text()).toContain("認証エラーが発生しました");
    expect(wrapper.text()).not.toContain("view-body");
  });

  it("shows the app when live data is present without a token", async () => {
    const { wrapper, router } = buildWrapper((store) => {
      store.data = normalizeHealth(sampleApi);
      store.source = "live";
    });
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain("Googleログインが必要です");
    expect(wrapper.text()).toContain("view-body");
    expect(wrapper.text()).toContain("健康可視化");
  });

  it("shows a logout button when an ID token is saved", async () => {
    localStorage.setItem("health-google-id-token", "saved-token");
    const { wrapper, router } = buildWrapper((store) => {
      store.data = normalizeHealth(sampleApi);
      store.source = "live";
    });
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();
    const buttons = wrapper.findAll("button");
    expect(buttons.some((b) => b.text() === "ログアウト")).toBe(true);
  });

  it("shows the share-expired screen in share mode without data", async () => {
    sessionStorage.setItem("health-share-token", "expired-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 401, error: "share session expired or invalid" }),
    })));
    const { wrapper } = buildWrapper();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("閲覧用リンクの有効期限が切れています");
    expect(wrapper.text()).not.toContain("Googleログインが必要です");
    expect(wrapper.text()).not.toContain("view-body");
  });

  it("shows the share banner in share mode with data", async () => {
    const { wrapper, router } = buildWrapper((store) => {
      store.shareMode = true;
      store.shareExpiresAt = "2999-10-31T05:30:00.000Z";
      store.data = normalizeHealth(sampleApi);
      store.source = "live";
    });
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("医師向け閲覧リンクで表示中です");
    expect(wrapper.text()).toContain("まで有効");
    expect(wrapper.text()).toContain("view-body");
    expect(wrapper.text()).not.toContain("Googleログインが必要です");
  });

  it("hides the privacy toggle and suspends masking in share mode", async () => {
    document.documentElement.removeAttribute("data-private");
    const { wrapper, router } = buildWrapper(
      (store) => {
        store.shareMode = true;
        store.shareExpiresAt = "2999-10-31T05:30:00.000Z";
        store.data = normalizeHealth(sampleApi);
        store.source = "live";
      },
      (ui) => {
        ui.privateMode = true;
      },
    );
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();
    const buttons = wrapper.findAll("button");
    expect(buttons.some((b) => b.text() === "数値を表示" || b.text() === "数値を隠す")).toBe(false);
    expect(document.documentElement.hasAttribute("data-private")).toBe(false);
  });

  it("shows the privacy toggle outside share mode", async () => {
    const { wrapper, router } = buildWrapper((store) => {
      store.data = normalizeHealth(sampleApi);
      store.source = "live";
    });
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();
    const buttons = wrapper.findAll("button");
    expect(buttons.some((b) => b.text() === "数値を隠す")).toBe(true);
  });
});
