import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import Labs from "@/views/Labs.vue";
import { useHealthStore } from "@/stores/health";
import { normalizeHealth } from "@/domain/normalize";

const labPayload = {
  lab_results: [
    { date: "2025-01-10", panel: "血液検査", category: "肝機能", item: "γ-GTP", value: 300, flag: "H", unit: "IU/L", reference: "13-64", source: "検査結果報告書（皮膚科）" },
    { date: "2026-01-10", panel: "血液検査", category: "肝機能", item: "γ-GTP", value: 200, flag: "H", unit: "IU/L", reference: "13-64", source: "検査結果報告書（皮膚科）" },
    { date: "2026-08-20", panel: "血液検査", category: "肝機能", item: "γ-GTP", value: 178, flag: "H", unit: "IU/L", reference: "13-64", source: "検査結果報告書（皮膚科）" },
    { date: "2025-01-10", panel: "血液検査", category: "肝機能", item: "ALT", value: 60, flag: "H", unit: "IU/L", reference: "10-42", source: "検査結果報告書（皮膚科）" },
    { date: "2026-08-20", panel: "血液検査", category: "肝機能", item: "ALT", value: 40, flag: "", unit: "IU/L", reference: "10-42", source: "検査結果報告書（皮膚科）" },
  ],
};

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  store.data = normalizeHealth(labPayload);
  store.source = "live";
  const wrapper = mount(Labs, { global: { plugins: [pinia] } });
  return { wrapper, store };
}

describe("labs view", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders featured-item tabs with γ-GTP active by default", async () => {
    const { wrapper } = buildWrapper();
    await wrapper.vm.$nextTick();
    const tabs = wrapper.findAll("button.lab-tab");
    const labels = tabs.map((t) => t.text());
    expect(labels).toContain("γ-GTP");
    expect(labels).toContain("ALT");
    const active = wrapper.find("button.lab-tab.is-active");
    expect(active.text()).toBe("γ-GTP");
  });

  it("switches the active tab when another item is clicked", async () => {
    const { wrapper } = buildWrapper();
    await wrapper.vm.$nextTick();
    const altTab = wrapper.findAll("button.lab-tab").find((t) => t.text() === "ALT");
    await altTab.trigger("click");
    expect(wrapper.find("button.lab-tab.is-active").text()).toBe("ALT");
    expect(wrapper.findAll("button.lab-tab").find((t) => t.text() === "γ-GTP").classes()).not.toContain("is-active");
  });

  it("does not render the old all-items selector", async () => {
    const { wrapper } = buildWrapper();
    await wrapper.vm.$nextTick();
    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("全項目から選択");
  });

  it("renders per-date result tables newest first", async () => {
    const { wrapper } = buildWrapper();
    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text.indexOf("2026-08-20")).toBeLessThan(text.indexOf("2025-01-10"));
    expect(text).toContain("γ-GTP");
  });
});
