import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import Overview from "@/views/Overview.vue";
import { useHealthStore } from "@/stores/health";
import sampleApi from "@/mocks/sampleApi.json";
import { normalizeHealth } from "@/domain/normalize";

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  store.data = normalizeHealth(sampleApi);
  store.source = "live";
  return mount(Overview, { global: { plugins: [pinia] } });
}

function cardByLabel(wrapper, labelPart) {
  return wrapper.findAll("section.card").find((c) => c.find("h2").text().includes(labelPart));
}

describe("overview privacy masking rules", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps weight and muscle values masked", () => {
    const wrapper = buildWrapper();
    for (const label of ["最新体重", "筋肉量"]) {
      const card = cardByLabel(wrapper, label);
      expect(card, label).toBeTruthy();
      expect(card.find("p.amount-value").classes()).not.toContain("is-public");
    }
  });

  it("does not mask body fat percent, visceral fat level, or remaining kg to the interim goal", () => {
    const wrapper = buildWrapper();
    for (const label of ["体脂肪率", "内臓脂肪レベル", "中間目標"]) {
      const card = cardByLabel(wrapper, label);
      expect(card, label).toBeTruthy();
      expect(card.find("p.amount-value").classes()).toContain("is-public");
    }
  });

  it("keeps the remaining kg to the final goal masked", () => {
    const wrapper = buildWrapper();
    const card = cardByLabel(wrapper, "最終目標");
    expect(card).toBeTruthy();
    expect(card.find("p.amount-value").classes()).not.toContain("is-public");
  });

  it("keeps goal numbers in card labels masked", () => {
    const wrapper = buildWrapper();
    const interim = cardByLabel(wrapper, "中間目標");
    expect(interim.find("h2 .privacy-mask").exists()).toBe(true);
    const final = cardByLabel(wrapper, "最終目標");
    expect(final.find("h2 .privacy-mask").exists()).toBe(true);
  });
});
