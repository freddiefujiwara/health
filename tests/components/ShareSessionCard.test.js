import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import ShareSessionCard from "@/components/ShareSessionCard.vue";
import { useHealthStore } from "@/stores/health";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,TESTQR"),
  },
}));

const okResponse = (json) => ({ ok: true, json: async () => json });

function buildWrapper() {
  const pinia = createPinia();
  const store = useHealthStore(pinia);
  const wrapper = mount(ShareSessionCard, { global: { plugins: [pinia] } });
  return { wrapper, store };
}

describe("share session card", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("health-google-id-token", "owner-token");
  });

  it("shows the issue button before a session is issued", () => {
    const { wrapper } = buildWrapper();
    expect(wrapper.text()).toContain("医師向け一時閲覧リンク");
    expect(wrapper.text()).toContain("30分間有効な閲覧用URLを発行");
    expect(wrapper.find("input.share-url-input").exists()).toBe(false);
  });

  it("issues a session and shows the URL, QR code, and remaining time", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({
      share_token: "share-token-xyz",
      expires_at: expiresAt,
      ttl_seconds: 1800,
    })));
    const { wrapper } = buildWrapper();
    const issueButton = wrapper.findAll("button").find((b) => b.text().includes("発行"));
    await issueButton.trigger("click");
    await flushPromises();

    const input = wrapper.find("input.share-url-input");
    expect(input.exists()).toBe(true);
    expect(input.element.value).toContain("#share=share-token-xyz");
    expect(wrapper.find("img").attributes("src")).toBe("data:image/png;base64,TESTQR");
    expect(wrapper.text()).toContain("残り約30分");
    expect(wrapper.text()).toContain("今すぐ無効化する");
  });

  it("revokes the session and returns to the issue state", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => okResponse({
        share_token: "share-token-xyz",
        expires_at: expiresAt,
      }))
      .mockImplementationOnce(async () => okResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = buildWrapper();
    await wrapper.findAll("button").find((b) => b.text().includes("発行")).trigger("click");
    await flushPromises();
    expect(store.issuedShare).not.toBeNull();

    await wrapper.findAll("button").find((b) => b.text().includes("無効化")).trigger("click");
    await flushPromises();
    expect(store.issuedShare).toBeNull();
    expect(wrapper.find("input.share-url-input").exists()).toBe(false);
    expect(wrapper.text()).toContain("30分間有効な閲覧用URLを発行");
  });

  it("shows an error when issuing fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const { wrapper } = buildWrapper();
    await wrapper.findAll("button").find((b) => b.text().includes("発行")).trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("network down");
    expect(wrapper.find("input.share-url-input").exists()).toBe(false);
  });

  it("disables the issue button and shows progress while issuing", async () => {
    let resolveFetch;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => pending));
    const { wrapper } = buildWrapper();
    const issueButton = wrapper.findAll("button").find((b) => b.text().includes("発行"));
    await issueButton.trigger("click");

    const busyButton = wrapper.findAll("button").find((b) => b.text().includes("発行中"));
    expect(busyButton).toBeTruthy();
    expect(busyButton.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("サーバーと通信しています");

    resolveFetch(okResponse({
      share_token: "share-token-xyz",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));
    await flushPromises();
    expect(wrapper.find("input.share-url-input").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("サーバーと通信しています");
  });

  it("disables the revoke button and shows progress while revoking", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    let resolveRevoke;
    const pendingRevoke = new Promise((resolve) => {
      resolveRevoke = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => okResponse({
        share_token: "share-token-xyz",
        expires_at: expiresAt,
      }))
      .mockImplementationOnce(() => pendingRevoke);
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper } = buildWrapper();
    await wrapper.findAll("button").find((b) => b.text().includes("発行")).trigger("click");
    await flushPromises();

    await wrapper.findAll("button").find((b) => b.text().includes("無効化")).trigger("click");
    const busyButton = wrapper.findAll("button").find((b) => b.text().includes("無効化中"));
    expect(busyButton).toBeTruthy();
    expect(busyButton.attributes("disabled")).toBeDefined();

    resolveRevoke(okResponse({ revoked: true }));
    await flushPromises();
    expect(wrapper.find("input.share-url-input").exists()).toBe(false);
  });

  it("disables the copy button and URL field while re-issuing", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    let resolveReissue;
    const pendingReissue = new Promise((resolve) => {
      resolveReissue = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => okResponse({
        share_token: "share-token-xyz",
        expires_at: expiresAt,
      }))
      .mockImplementationOnce(() => pendingReissue);
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper } = buildWrapper();
    await wrapper.findAll("button").find((b) => b.text().includes("発行")).trigger("click");
    await flushPromises();
    expect(wrapper.find("input.share-url-input").exists()).toBe(true);

    await wrapper.findAll("button").find((b) => b.text().includes("発行し直す")).trigger("click");
    const copyButton = wrapper.findAll("button").find((b) => b.text().includes("コピー"));
    expect(copyButton.attributes("disabled")).toBeDefined();
    expect(wrapper.find("input.share-url-input").attributes("disabled")).toBeDefined();

    resolveReissue(okResponse({
      share_token: "share-token-new",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));
    await flushPromises();
    const copyAfter = wrapper.findAll("button").find((b) => b.text().includes("コピー"));
    expect(copyAfter.attributes("disabled")).toBeUndefined();
    expect(wrapper.find("input.share-url-input").element.value).toContain("share-token-new");
  });

  it("copies the URL to the clipboard", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({
      share_token: "share-token-xyz",
      expires_at: expiresAt,
    })));
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { wrapper } = buildWrapper();
    await wrapper.findAll("button").find((b) => b.text().includes("発行")).trigger("click");
    await flushPromises();
    const copyButton = wrapper.findAll("button").find((b) => b.text().includes("コピー"));
    await copyButton.trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#share=share-token-xyz"));
    expect(wrapper.text()).toContain("コピーしました");
  });
});
