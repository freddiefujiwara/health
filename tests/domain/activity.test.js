import { describe, expect, it } from "vitest";
import {
  lateNightMinutesByDate,
  outBandsForDay,
  sleepBandsForDay,
  timeToHours,
} from "../../src/domain/activity";

describe("timeToHours", () => {
  it("converts HH:MM to fractional hours", () => {
    expect(timeToHours("21:09")).toBeCloseTo(21.15);
    expect(timeToHours("04:05")).toBeCloseTo(4 + 5 / 60);
    expect(timeToHours("00:00")).toBe(0);
  });

  it("returns null without a time", () => {
    expect(timeToHours(null)).toBeNull();
    expect(timeToHours("")).toBeNull();
    expect(timeToHours(undefined)).toBeNull();
  });
});

describe("lateNightMinutesByDate", () => {
  it("sums only the 23:00-04:29 hours per date", () => {
    const rows = [
      { date: "2026-11-16", hour: 23, engagedMinutesEst: 30 },
      { date: "2026-11-16", hour: 0, engagedMinutesEst: 12 },
      { date: "2026-11-16", hour: 4, engagedMinutesEst: 3 },
      { date: "2026-11-16", hour: 5, engagedMinutesEst: 40 },
      { date: "2026-11-16", hour: 12, engagedMinutesEst: 60 },
      { date: "2026-11-17", hour: 1, engagedMinutesEst: null },
      { date: "2026-11-17", hour: 2, engagedMinutesEst: 7 },
    ];
    const map = lateNightMinutesByDate(rows);
    expect(map.get("2026-11-16")).toBe(45);
    expect(map.get("2026-11-17")).toBe(7);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for no rows", () => {
    expect(lateNightMinutesByDate([]).size).toBe(0);
  });
});

describe("sleepBandsForDay", () => {
  const rows = [
    { date: "2026-11-17", sleepStartEst: "21:09", sleepEndEst: "23:47", durationMinutesEst: 157 },
    { date: "2026-11-16", sleepStartEst: "22:07", sleepEndEst: "04:20", durationMinutesEst: 372 },
    { date: "2026-11-15", sleepStartEst: null, sleepEndEst: null, durationMinutesEst: null },
    { date: "2026-11-14", sleepStartEst: "01:00", sleepEndEst: "05:00", durationMinutesEst: 240 },
  ];

  it("keeps an interval ending before midnight on the previous evening", () => {
    expect(sleepBandsForDay(rows, "2026-11-17")).toEqual([]);
    const bands = sleepBandsForDay(rows, "2026-11-16");
    const evening = bands.find((b) => b.note.startsWith("21:09"));
    expect(evening.from).toBeCloseTo(21.15);
    expect(evening.to).toBeCloseTo(23 + 47 / 60);
    expect(evening.label).toBe("2時間37分");
    expect(evening.note).toBe("21:09–23:47、2時間37分");
  });

  it("clamps an overnight interval to each day it overlaps", () => {
    const on16 = sleepBandsForDay(rows, "2026-11-16").find((b) => b.note.startsWith("22:07"));
    expect(on16.from).toBe(0);
    expect(on16.to).toBeCloseTo(4 + 20 / 60);
    const on15 = sleepBandsForDay(rows, "2026-11-15").find((b) => b.note.startsWith("22:07"));
    expect(on15.from).toBeCloseTo(22 + 7 / 60);
    expect(on15.to).toBe(24);
  });

  it("treats a start before 20:00 as sitting on the wake date", () => {
    const bands = sleepBandsForDay(rows, "2026-11-14");
    expect(bands).toHaveLength(1);
    expect(bands[0].from).toBe(1);
    expect(bands[0].to).toBe(5);
    expect(bands[0].note).toBe("01:00–05:00、4時間");
    expect(sleepBandsForDay(rows, "2026-11-13")).toEqual([]);
  });

  it("skips rows without times and days with no overlap", () => {
    expect(sleepBandsForDay(rows, "2026-11-15").some((b) => b.note.includes("null"))).toBe(false);
    expect(sleepBandsForDay(rows, "2026-11-10")).toEqual([]);
    expect(sleepBandsForDay([], "2026-11-16")).toEqual([]);
  });
});

describe("outBandsForDay", () => {
  const seg = (over) => ({
    date: "2026-11-23",
    startMinute: 536,
    endMinute: 767,
    state: "out",
    minutes: 231,
    ...over,
  });

  it("converts an out segment into a sky band with a note", () => {
    expect(outBandsForDay([seg({})], "2026-11-23")).toEqual([
      {
        from: 536 / 60,
        to: 767 / 60,
        label: "3時間51分",
        note: "08:56–12:47、3時間51分",
        color: "#38bdf8",
      },
    ]);
  });

  it("labels a band ending at midnight as 24:00", () => {
    const bands = outBandsForDay([seg({ startMinute: 1300, endMinute: 1440 })], "2026-11-23");
    expect(bands[0].note).toContain("24:00");
  });

  it("skips home segments, other days and malformed rows", () => {
    expect(
      outBandsForDay(
        [
          seg({ state: "home" }),
          seg({ date: "2026-11-22" }),
          seg({ startMinute: null }),
          seg({ endMinute: undefined }),
          null,
        ],
        "2026-11-23",
      ),
    ).toEqual([]);
    expect(outBandsForDay(undefined, "2026-11-23")).toEqual([]);
  });
});
