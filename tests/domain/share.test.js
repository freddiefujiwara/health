import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "../../src/domain/share";

describe("parseShareToken", () => {
  it("extracts the token from a share fragment", () => {
    expect(parseShareToken("#share=abc123")).toBe("abc123");
  });

  it("extracts the token when other parameters are present", () => {
    expect(parseShareToken("#foo=1&share=tok%20en&bar=2")).toBe("tok en");
  });

  it("accepts a fragment without the leading #", () => {
    expect(parseShareToken("share=xyz")).toBe("xyz");
  });

  it("returns an empty string for empty or missing input", () => {
    expect(parseShareToken("")).toBe("");
    expect(parseShareToken("#")).toBe("");
    expect(parseShareToken(null)).toBe("");
    expect(parseShareToken(undefined)).toBe("");
  });

  it("returns an empty string when no share parameter exists", () => {
    expect(parseShareToken("#overview")).toBe("");
    expect(parseShareToken("#shared=abc")).toBe("");
  });
});

describe("buildShareUrl", () => {
  it("appends the share fragment", () => {
    expect(buildShareUrl("https://example.com/health/", "tok")).toBe(
      "https://example.com/health/#share=tok",
    );
  });

  it("encodes special characters in the token", () => {
    expect(buildShareUrl("https://example.com/health/", "a b")).toBe(
      "https://example.com/health/#share=a%20b",
    );
  });
});

describe("shareSecondsLeft", () => {
  it("computes the remaining seconds", () => {
    const now = Date.parse("2026-10-31T00:00:00.000Z");
    expect(shareSecondsLeft("2026-10-31T00:30:00.000Z", now)).toBe(1800);
  });

  it("rounds partial seconds up", () => {
    const now = Date.parse("2026-10-31T00:00:00.500Z");
    expect(shareSecondsLeft("2026-10-31T00:30:00.000Z", now)).toBe(1800);
  });

  it("clamps expired sessions to zero", () => {
    const now = Date.parse("2026-10-31T01:00:00.000Z");
    expect(shareSecondsLeft("2026-10-31T00:30:00.000Z", now)).toBe(0);
  });

  it("returns null for an invalid date", () => {
    expect(shareSecondsLeft("not-a-date", 0)).toBeNull();
    expect(shareSecondsLeft("", 0)).toBeNull();
  });
});

describe("formatShareRemaining", () => {
  it("formats minutes", () => {
    expect(formatShareRemaining(1800)).toBe("残り約30分");
    expect(formatShareRemaining(61)).toBe("残り約2分");
    expect(formatShareRemaining(60)).toBe("残り約1分");
  });

  it("formats under a minute", () => {
    expect(formatShareRemaining(59)).toBe("残り約1分未満");
    expect(formatShareRemaining(1)).toBe("残り約1分未満");
  });

  it("formats expired and unknown", () => {
    expect(formatShareRemaining(0)).toBe("期限切れ");
    expect(formatShareRemaining(null)).toBe("");
  });
});
