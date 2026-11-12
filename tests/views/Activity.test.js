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
    expect(wrapper.text()).toContain("推定会話時間（直近30日）");
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("2026-11-12");
    expect(rows[0].text()).toContain("14時間30分");
    expect(rows[0].text()).toContain("04:14");
    expect(rows[1].text()).toContain("2026-11-11");
    expect(rows[1].text()).toContain("18時間15分");
  });
});
