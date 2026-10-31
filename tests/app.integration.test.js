import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import Overview from "@/views/Overview.vue";
import { useHealthStore } from "@/stores/health";
import sampleApi from "@/mocks/sampleApi.json";
import { normalizeHealth } from "@/domain/normalize";

describe("app integration", () => {
  it("renders the overview with normalized sample data", async () => {
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/overview", component: Overview },
        { path: "/body", component: { template: "<div />" } },
        { path: "/nutrition", component: { template: "<div />" } },
        { path: "/steps", component: { template: "<div />" } },
        { path: "/labs", component: { template: "<div />" } },
      ],
    });
    const store = useHealthStore(pinia);
    store.data = normalizeHealth(sampleApi);
    store.source = "live";

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    });
    await router.push("/overview");
    await router.isReady();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("健康可視化");
    expect(wrapper.text()).toContain("概要");
    expect(wrapper.text()).toContain("最新体重");
  });
});
