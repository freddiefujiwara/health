import { afterEach, describe, expect, it, vi } from "vitest";

// The store computes its storage keys at module load from
// isStagingBuild(), so each case re-imports the module with a
// stubbed environment.
describe("health store storage keys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the plain keys outside staging", async () => {
    vi.resetModules();
    const mod = await import("@/stores/health.js");
    expect(mod.SESSION_TOKEN_STORAGE_KEY).toBe("health-session-token");
    expect(mod.SHARE_TOKEN_STORAGE_KEY).toBe("health-share-token");
  });

  it("suffixes both keys with :staging in a staging build", async () => {
    vi.stubEnv("VITE_STAGING", "1");
    vi.resetModules();
    const mod = await import("@/stores/health.js");
    expect(mod.SESSION_TOKEN_STORAGE_KEY).toBe(
      "health-session-token:staging",
    );
    expect(mod.SHARE_TOKEN_STORAGE_KEY).toBe("health-share-token:staging");
  });
});
