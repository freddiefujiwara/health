import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import Activity from "@/views/Activity.vue";
import { useHealthStore } from "@/stores/health";
import { normalizeHealth } from "@/domain/normalize";

const payload = {
  chat_activity: [
    { date: "2026-11-11", user_message_count: 280, engaged_minutes_est: 1095, session_count: 6, first_message_at: "01:37", last_message_at: "22:29", late_night_message_count: 35 },
    { date: "2026-11-12", user_message_count: 227, engaged_minutes_est: 870, session_count: 7, first_message_at: "04:14", last_message_at: "23:11", late_night_message_count: 3 },
  ],
};

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  store.data = normalizeHealth(payload);
  store.source = "live";
  return mount(Activity, { global: { plugins: [pinia] } });
}

describe("activity view", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders summary cards and the daily table newest first", async () => {
    const wrapper = buildWrapper();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("記録日数");
    expect(wrapper.text()).toContain("2 日");
    expect(wrapper.text()).toContain("スマホ使用時間（直近30日）");
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("2026-11-12");
    expect(rows[0].text()).toContain("14時間30分");
    expect(rows[0].text()).toContain("04:14");
    expect(rows[1].text()).toContain("2026-11-11");
    expect(rows[1].text()).toContain("18時間15分");
  });
});

describe("activity view hourly section", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders the hourly chart section with peak hours", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_hours: [
        { hour: 5, user_message_count: 426, engaged_minutes_est: 742 },
        { hour: 18, user_message_count: 384, engaged_minutes_est: 961 },
        { hour: 1, user_message_count: 90, engaged_minutes_est: 378 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("時間帯別の活動量");
    expect(wrapper.text()).toContain("5時台（426回）");
    expect(wrapper.text()).toContain("18時台（384回）");
  });
});

describe("activity view tabs and line chart", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  function mountWithDailyHours() {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_hours: [
        { hour: 5, user_message_count: 426, engaged_minutes_est: 742 },
        { hour: 18, user_message_count: 384, engaged_minutes_est: 961 },
      ],
      chat_activity_daily_hours: [
        { date: "2026-11-12", hour: 5, user_message_count: 28, engaged_minutes_est: 59 },
        { date: "2026-11-12", hour: 17, user_message_count: 24, engaged_minutes_est: 63 },
        { date: "2026-11-11", hour: 21, user_message_count: 26, engaged_minutes_est: 56 },
      ],
    });
    store.source = "live";
    return mount(Activity, { global: { plugins: [pinia] } });
  }

  it("navigates days with prev/next arrows and returns to total", async () => {
    const wrapper = mountWithDailyHours();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("時間帯別の活動量");
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
    expect(wrapper.text()).toContain("多い時間帯：5時台（426回）");
    const prev = wrapper.find('button[aria-label="前の日"]');
    const next = wrapper.find('button[aria-label="次の日"]');
    expect(next.attributes("disabled")).toBeDefined();
    await prev.trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/12");
    expect(wrapper.text()).toContain("多い時間帯：5時台（28回）、17時台（24回）");
    expect(wrapper.text()).toContain("2026/11/12 の合計は 52 回です");
    await next.trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
    await prev.trigger("click");
    await prev.trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/11");
    await wrapper.find(".hour-total-btn").trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
  });

  it("renders the daily minutes chart as a line chart", async () => {
    const wrapper = mountWithDailyHours();
    await wrapper.vm.$nextTick();
    const lineChart = wrapper.find(".line-chart");
    expect(lineChart.exists()).toBe(true);
    expect(lineChart.findAll('path[fill="none"]').length).toBeGreaterThanOrEqual(1);
  });
  it("shows the sleep band on a day view but not on the total view", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    const dailyHours = [];
    for (let h = 0; h < 24; h += 1) {
      dailyHours.push({ date: "2026-11-12", hour: h, user_message_count: h === 5 ? 28 : 0, engaged_minutes_est: 0 });
    }
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_hours: [
        { hour: 5, user_message_count: 426, engaged_minutes_est: 742 },
      ],
      chat_activity_daily_hours: dailyHours,
      sleep_estimates: [
        { date: "2026-11-12", sleep_start_est: "22:29", sleep_end_est: "04:14", duration_minutes_est: 345 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
    expect(wrapper.findAll("rect.band")).toHaveLength(0);
    await wrapper.find('button[aria-label="前の日"]').trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/12");
    expect(wrapper.findAll("rect.band")).toHaveLength(1);
    expect(wrapper.text()).toContain("紫の帯は推定睡眠として数えた区間です");
    const bandLabels = wrapper.findAll("text.band-label");
    expect(bandLabels).toHaveLength(1);
    expect(bandLabels[0].text()).toBe("推定睡眠 22:29–04:14（5時間45分）");
  });
});


describe("activity view sleep card", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shows the average sleep estimate as a card, without a chart section", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      sleep_estimates: [
        { date: "2026-11-11", sleep_start_est: "22:50", sleep_end_est: "01:37", duration_minutes_est: 166 },
        { date: "2026-11-12", sleep_start_est: "22:29", sleep_end_est: "04:14", duration_minutes_est: 345 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("直近7日 平均推定睡眠");
    expect(wrapper.text()).toContain("4時間16分");
    expect(wrapper.text()).not.toContain("推定睡眠時間（直近30日）");
  });

  it("places the hourly chart above the daily usage chart", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_hours: [
        { hour: 5, user_message_count: 426, engaged_minutes_est: 742 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text.indexOf("時間帯別の活動量")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("時間帯別の活動量")).toBeLessThan(text.indexOf("スマホ使用時間（直近30日）"));
  });
});
