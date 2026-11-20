import { describe, expect, it } from "vitest";
import {
  formatDateWithWeekday,
  formatDecimal,
  formatDurationMinutes,
  formatInteger,
  formatKg,
  formatPercentChange,
} from "../../src/domain/format";
import {
  bloodPressureEntry,
  featuredLabSeries,
  groupLabResults,
  labItemSeries,
  labItemUnit,
} from "../../src/domain/labs";
import { lateNightMinutesByDate, sleepBandsForDay, timeToHours } from "../../src/domain/activity";
import {
  buildShareUrl,
  formatShareRemaining,
  parseShareToken,
  shareSecondsLeft,
} from "../../src/domain/share";

// Abnormal-case tests for the display layer. The contract follows the
// module's own precedent (formatChartValue renders "-" for anything
// that is not a finite number): a deformed value renders as the
// missing-value label, never as "NaN", "undefined" or "[object
// Object]", and never throws.
const badToString = { toString: [] };

describe("number formatters with deformed values", () => {
  it("renders the missing-value dash for non-finite numbers", () => {
    expect(formatInteger(Number.NaN)).toBe("-");
    expect(formatInteger(Number.POSITIVE_INFINITY)).toBe("-");
    expect(formatDecimal(Number.NaN)).toBe("-");
    expect(formatDecimal(Number.NEGATIVE_INFINITY)).toBe("-");
    expect(formatKg(Number.NaN)).toBe("- kg");
    expect(formatDurationMinutes(Number.NaN)).toBe("-");
    expect(formatDurationMinutes(Number.POSITIVE_INFINITY)).toBe("-");
  });

  it("renders the dash for non-number values instead of leaking text", () => {
    expect(formatInteger("abc")).toBe("-");
    expect(formatInteger(badToString)).toBe("-");
    expect(formatDecimal("abc")).toBe("-");
    expect(formatPercentChange(Number.NaN, 100)).toBe("-");
    expect(formatPercentChange(Number.POSITIVE_INFINITY, 100)).toBe("-");
    expect(formatPercentChange(100, Number.NaN)).toBe("-");
    expect(formatPercentChange("90", 100)).toBe("-");
    expect(formatPercentChange(1e308, 1e-308)).toBe("-");
  });
});

describe("formatDateWithWeekday with deformed dates", () => {
  it("returns an empty string instead of throwing or leaking", () => {
    expect(formatDateWithWeekday(20261112)).toBe("");
    expect(formatDateWithWeekday(badToString)).toBe("");
    expect(formatDateWithWeekday("garbage")).toBe("");
    expect(formatDateWithWeekday("2026-11-xx")).toBe("");
    expect(formatDateWithWeekday("2026-13-45")).toBe("");
    expect(formatDateWithWeekday("2026-02-30")).toBe("");
    expect(formatDateWithWeekday("2026-11-12")).toBe("2026/11/12（木）");
  });
});

describe("lab helpers with deformed rows", () => {
  it("tolerates missing lists and non-object rows", () => {
    expect(groupLabResults(null)).toEqual([]);
    expect(groupLabResults(undefined)).toEqual([]);
    expect(groupLabResults([null, 42, "x"])).toEqual([]);
    expect(labItemSeries(null, "γ-GTP")).toEqual([]);
    expect(labItemSeries([null], "γ-GTP")).toEqual([]);
    expect(labItemUnit(null, "γ-GTP")).toBe("");
    expect(labItemUnit([null], "γ-GTP")).toBe("");
    expect(featuredLabSeries(null)).toEqual([]);
    expect(bloodPressureEntry(null)).toBeNull();
  });

  it("keeps healthy rows when a sibling row is deformed", () => {
    const rows = [
      null,
      { date: "2026-08-20", panel: "血液検査", item: "γ-GTP", valueNumber: 178, unit: "IU/L" },
      { date: "2026-08-20", panel: "血液検査", item: "γ-GTP", valueNumber: 180, unit: "IU/L" },
    ];
    expect(groupLabResults(rows)).toHaveLength(1);
    expect(labItemSeries(rows, "γ-GTP")).toHaveLength(2);
    expect(labItemUnit(rows, "γ-GTP")).toBe("IU/L");
  });

  it("excludes non-finite and non-numeric values from the series", () => {
    const rows = [
      { date: "2026-01-01", item: "x", valueNumber: Number.NaN },
      { date: "2026-01-02", item: "x", valueNumber: Number.POSITIVE_INFINITY },
      { date: "2026-01-03", item: "x", valueNumber: "abc" },
      { date: "2026-01-04", item: "x", valueNumber: badToString },
      { date: "2026-01-05", item: "x", valueNumber: 42 },
    ];
    expect(labItemSeries(rows, "x")).toEqual([{ date: "2026-01-05", value: 42 }]);
  });
});

describe("activity helpers with deformed rows", () => {
  it("reads unparseable and non-string times as no time", () => {
    expect(timeToHours(2130)).toBeNull();
    expect(timeToHours(badToString)).toBeNull();
    expect(timeToHours("abc")).toBeNull();
    expect(timeToHours("21")).toBeNull();
    expect(timeToHours("21:09")).toBeCloseTo(21.15);
  });

  it("skips deformed sleep rows instead of throwing", () => {
    const day = "2026-11-12";
    expect(sleepBandsForDay(null, day)).toEqual([]);
    expect(sleepBandsForDay(undefined, day)).toEqual([]);
    expect(sleepBandsForDay([null], day)).toEqual([]);
    expect(
      sleepBandsForDay(
        [{ date: "2026-11-12", sleepStartEst: 2200, sleepEndEst: "04:00", durationMinutesEst: 300 }],
        day,
      ),
    ).toEqual([]);
    expect(
      sleepBandsForDay(
        [{ date: "2026-11-12", sleepStartEst: "22:00", sleepEndEst: "04:00", durationMinutesEst: 360 }],
        "garbage",
      ),
    ).toEqual([]);
  });

  it("keeps late-night totals numeric when minutes are deformed", () => {
    expect(lateNightMinutesByDate(null).size).toBe(0);
    expect(lateNightMinutesByDate([null]).size).toBe(0);
    const map = lateNightMinutesByDate([
      { date: "2026-11-12", hour: 23, engagedMinutesEst: "30" },
      { date: "2026-11-12", hour: 0, engagedMinutesEst: badToString },
      { date: "2026-11-12", hour: 1, engagedMinutesEst: 15 },
    ]);
    expect(map.get("2026-11-12")).toBe(15);
  });
});

describe("share helpers with deformed input", () => {
  it("reads a malformed share hash as no token instead of throwing", () => {
    // A truncated percent escape in a copied share link used to raise
    // URIError inside fetchHealth, before its error handling — the
    // same failure music-admin fixed in its share parser.
    expect(parseShareToken("#share=%E0%A4%A")).toBe("");
    expect(parseShareToken("#share=%")).toBe("");
    expect(parseShareToken(123)).toBe("");
    expect(parseShareToken({})).toBe("");
    expect(parseShareToken("#share=abc123")).toBe("abc123");
  });

  it("builds no fragment when there is no token to share", () => {
    expect(buildShareUrl("https://example.com/health/", "")).toBe("https://example.com/health/");
    expect(buildShareUrl("https://example.com/health/", null)).toBe("https://example.com/health/");
    expect(buildShareUrl("https://example.com/health/", undefined)).toBe(
      "https://example.com/health/",
    );
    expect(buildShareUrl("https://example.com/health/", "tok")).toBe(
      "https://example.com/health/#share=tok",
    );
  });

  it("never renders a non-finite remaining time", () => {
    expect(formatShareRemaining(Number.NaN)).toBe("");
    expect(formatShareRemaining(Number.POSITIVE_INFINITY)).toBe("");
    expect(shareSecondsLeft("2026-10-31T00:30:00.000Z", Number.NaN)).toBeNull();
  });
});
