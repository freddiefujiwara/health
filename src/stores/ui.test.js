import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUiStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-private");
  });

  it("defaults to dark theme with values visible", () => {
    const store = useUiStore();
    expect(store.theme).toBe("dark");
    expect(store.privateMode).toBe(false);
    expect(store.themeLabel).toBe("ライト");
    expect(store.privacyLabel).toBe("数値を隠す");
  });

  it("restores a stored light theme", () => {
    localStorage.setItem("health-theme", "light");
    localStorage.setItem("health-private", "on");
    setActivePinia(createPinia());
    const store = useUiStore();
    expect(store.theme).toBe("light");
    expect(store.privateMode).toBe(true);
    expect(store.themeLabel).toBe("ダーク");
    expect(store.privacyLabel).toBe("数値を表示");
  });

  it("toggles theme and privacy, persisting and applying them", () => {
    const store = useUiStore();
    store.toggleTheme();
    expect(store.theme).toBe("light");
    expect(localStorage.getItem("health-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    store.toggleTheme();
    expect(store.theme).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    store.togglePrivacy();
    expect(store.privateMode).toBe(true);
    expect(localStorage.getItem("health-private")).toBe("on");
    expect(document.documentElement.getAttribute("data-private")).toBe("on");
    store.togglePrivacy();
    expect(store.privateMode).toBe(false);
    expect(localStorage.getItem("health-private")).toBe("off");
    expect(document.documentElement.hasAttribute("data-private")).toBe(false);
  });

  it("suspends privacy masking without changing the saved preference", () => {
    localStorage.setItem("health-private", "on");
    setActivePinia(createPinia());
    const store = useUiStore();
    store.applyToDocument();
    expect(document.documentElement.getAttribute("data-private")).toBe("on");

    store.setPrivacySuspended(true);
    expect(store.privacySuspended).toBe(true);
    expect(store.privateMode).toBe(true);
    expect(localStorage.getItem("health-private")).toBe("on");
    expect(document.documentElement.hasAttribute("data-private")).toBe(false);

    store.setPrivacySuspended(false);
    expect(store.privacySuspended).toBe(false);
    expect(document.documentElement.getAttribute("data-private")).toBe("on");
  });
});
