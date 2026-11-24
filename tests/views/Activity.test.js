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
    expect(wrapper.text()).toContain("直近7日 平均活動時間");
    expect(wrapper.text()).toContain("直近30日 平均活動時間");
    expect(wrapper.text()).not.toContain("記録日数");
    expect(wrapper.text()).not.toContain("平均活動回数");
    expect(wrapper.text()).toContain("睡眠時間（直近30日・7日移動平均）");
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(wrapper.find("thead").text()).toContain("睡眠時間");
    expect(wrapper.find("thead").text()).toContain("深夜帯活動時間");
    expect(wrapper.find("thead").text()).not.toContain("セッション");
    expect(rows[0].text()).toContain("2026-11-12");
    expect(rows[0].text()).toContain("14時間30分");
    expect(rows[0].findAll("td")).toHaveLength(4);
    expect(rows[1].text()).toContain("2026-11-11");
    expect(rows[1].text()).toContain("18時間15分");
  });

  it("renders the work hours section when work_hours rows exist", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      work_hours: [
        { date: "2026-11-20", net_work_minutes: "", status: "未確定", first_arrive: "09:05", last_leave: "", pair_count: 0 },
        { date: "2026-11-21", net_work_minutes: 570, status: "確定", first_arrive: "09:00", last_leave: "18:30", pair_count: 1 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("勤務時間");
    expect(wrapper.text()).toContain("9時間30分");
    expect(wrapper.text()).toContain("未確定");
    expect(wrapper.text()).toContain("18:30");
  });

  it("renders the home hours section when home_hours rows exist", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      home_hours: [
        { date: "2026-11-20", home_minutes: "", status: "未確定", first_leave: "", last_arrive: "", outing_count: 0 },
        { date: "2026-11-21", home_minutes: 565, status: "確定", first_leave: "04:55", last_arrive: "19:30", outing_count: 1 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("家にいる時間");
    expect(wrapper.text()).toContain("9時間25分");
    expect(wrapper.text()).toContain("19:30");
  });

  it("renders segment rows inside the home hours table", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    store.data = normalizeHealth({
      home_hours: [
        { date: "2026-11-21", home_minutes: 1075, status: "確定", first_leave: "08:56", last_arrive: "16:55", outing_count: 2 },
      ],
      home_segments: [
        { date: "2026-11-21", start_minute: 0, end_minute: 536, state: "home", minutes: 536 },
        { date: "2026-11-21", start_minute: 536, end_minute: 772, state: "out", minutes: 236 },
        { date: "2026-11-21", start_minute: 1015, end_minute: 1440, state: "home", minutes: 425 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain("在宅・外出の時系列");
    expect(wrapper.text()).toContain("00:00–08:56");
    expect(wrapper.text()).toContain("08:56–12:52");
    expect(wrapper.text()).toContain("24:00");
    expect(wrapper.findAll(".segment-row")).toHaveLength(3);
    expect(wrapper.findAll(".segment-row")[1].text()).toContain("外出");
  });

  it("joins sleep and late-night minutes into the daily table by date", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    const dailyHours = [];
    for (let h = 0; h < 24; h += 1) {
      const late = { 23: 30, 0: 60, 4: 30 };
      dailyHours.push({
        date: "2026-11-12",
        hour: h,
        user_message_count: 0,
        engaged_minutes_est: late[h] ?? 0,
      });
    }
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_daily_hours: dailyHours,
      sleep_estimates: [
        { date: "2026-11-12", sleep_start_est: "22:29", sleep_end_est: "04:14", duration_minutes_est: 345 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    const rows = wrapper.findAll("tbody tr");
    // 2026-11-12: activity 14時間30分, sleep 5時間45分, late night 2時間
    expect(rows[0].text()).toContain("14時間30分");
    expect(rows[0].text()).toContain("5時間45分");
    expect(rows[0].text()).toContain("2時間");
    // 2026-11-11 has no sleep row: shown as "-"
    expect(rows[1].text()).toContain("-");
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
      sleep_estimates: [
        { date: "2026-11-11", sleep_start_est: "22:50", sleep_end_est: "01:37", duration_minutes_est: 166 },
        { date: "2026-11-12", sleep_start_est: "22:29", sleep_end_est: "04:14", duration_minutes_est: 345 },
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
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/12（木）");
    expect(wrapper.text()).toContain("多い時間帯：5時台（28回）、17時台（24回）");
    expect(wrapper.text()).toContain("2026/11/12（木） の合計は 52 回です");
    await next.trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
    await prev.trigger("click");
    await prev.trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/11（水）");
    await wrapper.find(".hour-total-btn").trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("合計");
  });

  it("renders the sleep moving-average chart as a line chart", async () => {
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
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/12（木）");
    expect(wrapper.findAll("rect.band")).toHaveLength(1);
    expect(wrapper.text()).toContain("紫の帯は推定睡眠として数えた区間です（22:29–04:14、5時間45分）");
    const bandLabels = wrapper.findAll("text.band-label");
    expect(bandLabels).toHaveLength(1);
    expect(bandLabels[0].text()).toBe("5時間45分");
  });

  it("draws an interval that ends before midnight on the previous evening only", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    const dailyHours = [];
    for (const date of ["2026-11-12", "2026-11-13"]) {
      for (let h = 0; h < 24; h += 1) {
        dailyHours.push({ date, hour: h, user_message_count: h === 5 ? 10 : 0, engaged_minutes_est: 0 });
      }
    }
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_hours: [
        { hour: 5, user_message_count: 426, engaged_minutes_est: 742 },
      ],
      chat_activity_daily_hours: dailyHours,
      sleep_estimates: [
        { date: "2026-11-13", sleep_start_est: "21:09", sleep_end_est: "23:47", duration_minutes_est: 157 },
      ],
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    // Wake date (11/13): the 21:09-23:47 interval happened on the
    // previous evening, so no band and no note on this day.
    await wrapper.find('button[aria-label="前の日"]').trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/13（金）");
    expect(wrapper.findAll("rect.band")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("紫の帯は推定睡眠として数えた区間です");
    // Previous evening (11/12): the band sits at 21:09-23:47.
    await wrapper.find('button[aria-label="前の日"]').trigger("click");
    expect(wrapper.find(".hour-nav-label").text()).toBe("2026/11/12（木）");
    expect(wrapper.findAll("rect.band")).toHaveLength(1);
    expect(wrapper.text()).toContain("紫の帯は推定睡眠として数えた区間です（21:09–23:47、2時間37分）");
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
    expect(wrapper.text()).toContain("直近7日 平均睡眠時間");
    expect(wrapper.text()).toContain("直近30日 平均睡眠時間");
    expect(wrapper.text()).toContain("4時間16分");
    expect(wrapper.text()).not.toContain("推定睡眠時間（直近30日）");
  });

  it("shows late-night activity time averaged from the hourly breakdown", async () => {
    const pinia = createPinia();
    const store = useHealthStore(pinia);
    const dailyHours = [];
    for (let h = 0; h < 24; h += 1) {
      const late = { 23: 30, 0: 60, 4: 30 };
      dailyHours.push({
        date: "2026-11-12",
        hour: h,
        user_message_count: 0,
        engaged_minutes_est: late[h] ?? (h === 12 ? 999 : 0),
      });
    }
    store.data = normalizeHealth({
      chat_activity: payload.chat_activity,
      chat_activity_daily_hours: dailyHours,
    });
    store.source = "live";
    const wrapper = mount(Activity, { global: { plugins: [pinia] } });
    await wrapper.vm.$nextTick();
    // 2026-11-12 late night = 30+60+30 = 120 min; 2026-11-11 has no hourly
    // rows (0 min), so the 7-day average is 60 min. The 999 min at noon must
    // not be counted.
    expect(wrapper.text()).toContain("直近7日 深夜帯の活動時間1時間");
    expect(wrapper.text()).toContain("直近30日 深夜帯の活動時間1時間");
  });

  it("places the hourly chart above the sleep chart", async () => {
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
    expect(text.indexOf("時間帯別の活動量")).toBeLessThan(text.indexOf("睡眠時間（直近30日・7日移動平均）"));
  });
});
