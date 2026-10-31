import { defineStore } from "pinia";

const THEME_KEY = "health-theme";
const PRIVACY_KEY = "health-private";

function readStored(key) {
  return globalThis.localStorage?.getItem(key) ?? "";
}

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: readStored(THEME_KEY) === "light" ? "light" : "dark",
    privateMode: readStored(PRIVACY_KEY) === "on",
    // Doctor share view: privacy is suspended (not persisted) so numbers
    // always stay visible while a share link is being viewed.
    privacySuspended: false,
  }),
  getters: {
    themeLabel: (state) => (state.theme === "light" ? "ダーク" : "ライト"),
    privacyLabel: (state) => (state.privateMode ? "数値を表示" : "数値を隠す"),
  },
  actions: {
    applyToDocument() {
      const root = document.documentElement;
      if (this.theme === "light") {
        root.setAttribute("data-theme", "light");
      } else {
        root.removeAttribute("data-theme");
      }
      if (this.privateMode && !this.privacySuspended) {
        root.setAttribute("data-private", "on");
      } else {
        root.removeAttribute("data-private");
      }
    },
    setPrivacySuspended(suspended) {
      this.privacySuspended = Boolean(suspended);
      this.applyToDocument();
    },
    toggleTheme() {
      this.theme = this.theme === "light" ? "dark" : "light";
      globalThis.localStorage?.setItem(THEME_KEY, this.theme);
      this.applyToDocument();
    },
    togglePrivacy() {
      this.privateMode = !this.privateMode;
      globalThis.localStorage?.setItem(PRIVACY_KEY, this.privateMode ? "on" : "off");
      this.applyToDocument();
    },
  },
});
