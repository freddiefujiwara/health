import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeHealth } from "../../src/domain/normalize";
import {
  addDays,
  average,
  goalProgressPercent,
  movingAverage,
  predictWeightKg,
  sum,
  trendLinePoints,
  weekdayIntakeAverages,
} from "../../src/domain/stats";
import {
  formatDateWithWeekday,
  formatDecimal,
  formatDurationMinutes,
  formatInteger,
  formatKg,
  formatPercentChange,
} from "../../src/domain/format";
import { groupLabResults, labItemSeries } from "../../src/domain/labs";
import { buildShareUrl, parseShareToken } from "../../src/domain/share";

// Property-based tests (fast-check). Generators stay inside the
// JSON domain the /exec endpoint can actually produce, plus the
// non-finite numbers that arithmetic in this module can manufacture.

const NUM_RUNS = 100;

// A cell value as it can arrive from a sheet via JSON: scalars, null,
// arrays and plain objects (including non-scalar junk).
const cellValue = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.string()),
  fc.object(),
);

// Numbers mixed with the junk a stats input can contain after shaping.
const statValue = fc.oneof(
  fc.integer({ min: -100000, max: 100000 }),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.string(),
  fc.boolean(),
);

const isoDate = fc
  .date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2100-12-31T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

describe("normalizeHealth properties", () => {
  it("never throws on generated payloads and always emits typed output", () => {
    fc.assert(
      fc.property(
        fc.record({
          body_composition: fc.oneof(fc.array(fc.object()), cellValue),
          daily_nutrition: fc.oneof(fc.array(fc.object()), cellValue),
          steps: fc.oneof(fc.array(fc.object()), cellValue),
          lab_results: fc.oneof(fc.array(fc.object()), cellValue),
          goals_settings: fc.oneof(fc.array(fc.object()), cellValue),
        }),
        (payload) => {
          const result = normalizeHealth(payload);
          for (const rows of [
            result.bodyComposition,
            result.dailyNutrition,
            result.steps,
            result.labResults,
          ]) {
            for (const row of rows) {
              expect(typeof row.date).toBe("string");
            }
          }
          for (const row of result.bodyComposition) {
            expect(row.weightKg === null || Number.isFinite(row.weightKg)).toBe(true);
          }
          expect(typeof result.goals.targetDate).toBe("string");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("conserves well-formed rows and sorts them by date", () => {
    const wellFormedRow = fc.record({
      date: isoDate,
      weight_kg: fc.integer({ min: 30, max: 200 }),
    });
    fc.assert(
      fc.property(fc.array(wellFormedRow, { maxLength: 30 }), (rows) => {
        const result = normalizeHealth({ body_composition: rows }).bodyComposition;
        expect(result).toHaveLength(rows.length);
        const dates = result.map((r) => r.date);
        expect(dates).toEqual([...dates].sort());
        for (const row of result) {
          expect(Number.isFinite(row.weightKg)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("stats properties", () => {
  it("average and sum only ever return null or a finite number", () => {
    fc.assert(
      fc.property(fc.array(statValue, { maxLength: 20 }), (values) => {
        for (const result of [average(values), sum(values)]) {
          expect(result === null || Number.isFinite(result)).toBe(true);
        }
        const finite = values.filter((v) => Number.isFinite(v));
        if (finite.length) {
          const avg = average(values);
          expect(avg).toBeGreaterThanOrEqual(Math.min(...finite));
          expect(avg).toBeLessThanOrEqual(Math.max(...finite));
          expect(sum(values)).toBeCloseTo(finite.reduce((a, b) => a + b, 0), 6);
        } else {
          expect(average(values)).toBeNull();
          expect(sum(values)).toBeNull();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("movingAverage preserves length and stays null-or-finite", () => {
    fc.assert(
      fc.property(
        fc.array(statValue, { maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (values, windowSize) => {
          const result = movingAverage(values, windowSize);
          expect(result).toHaveLength(values.length);
          for (const entry of result) {
            expect(entry === null || Number.isFinite(entry)).toBe(true);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("addDays round-trips and always yields an ISO date for valid input", () => {
    fc.assert(
      fc.property(isoDate, fc.integer({ min: -3650, max: 3650 }), (date, days) => {
        const shifted = addDays(date, days);
        expect(shifted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(addDays(shifted, -days)).toBe(date);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("addDays never throws on arbitrary text", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: -365, max: 365 }), (text, days) => {
        const result = addDays(text, days);
        expect(typeof result).toBe("string");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("trendLinePoints returns [] or two finite points drawn from the input dates", () => {
    const point = fc.record({
      date: fc.oneof(isoDate, fc.string()),
      value: fc.oneof(fc.integer({ min: -10000, max: 10000 }), fc.constant(null), fc.constant(Number.NaN)),
    });
    fc.assert(
      fc.property(fc.array(point, { maxLength: 12 }), (points) => {
        const result = trendLinePoints(points);
        expect(result.length === 0 || result.length === 2).toBe(true);
        const inputDates = new Set(points.map((p) => p.date));
        for (const p of result) {
          expect(Number.isFinite(p.value)).toBe(true);
          expect(inputDates.has(p.date)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("goalProgressPercent stays within 0-100 and predictions stay finite", () => {
    const finite = fc.double({ noNaN: true, noInfinity: true, min: -1000, max: 1000 });
    fc.assert(
      fc.property(finite, finite, finite, (start, latest, goal) => {
        const pct = goalProgressPercent(start, latest, goal);
        expect(pct === null || (pct >= 0 && pct <= 100)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
    fc.assert(
      fc.property(
        finite,
        finite,
        fc.integer({ min: 0, max: 365 }),
        fc.double({ noNaN: true, noInfinity: true, min: 1, max: 20000 }),
        (weight, balance, days, kcalPerKg) => {
          expect(Number.isFinite(predictWeightKg(weight, balance, days, kcalPerKg))).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("weekdayIntakeAverages always returns the seven weekday buckets", () => {
    const row = fc.record({
      date: fc.oneof(isoDate, fc.string()),
      intakeKcal: statValue,
      completeness: fc.oneof(fc.constant("完了"), fc.string()),
    });
    fc.assert(
      fc.property(fc.array(row, { maxLength: 30 }), (rows) => {
        const result = weekdayIntakeAverages(rows);
        expect(result.map((e) => e.day)).toEqual([6, 0, 1, 2, 3, 4, 5]);
        for (const entry of result) {
          expect(entry.averageIntakeKcal === null || Number.isFinite(entry.averageIntakeKcal)).toBe(
            true,
          );
          expect(entry.count).toBe(entry.values.length);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("format properties", () => {
  it("formatters never leak NaN, Infinity or undefined text", () => {
    const anyDouble = fc.double();
    fc.assert(
      fc.property(anyDouble, anyDouble, (a, b) => {
        const outputs = [
          formatInteger(a),
          formatDecimal(a),
          formatKg(a),
          formatDurationMinutes(a),
          formatPercentChange(a, b),
        ];
        for (const out of outputs) {
          expect(out).not.toMatch(/NaN|Infinity|undefined|\[object/);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("formatDateWithWeekday yields '' or a fully formatted date", () => {
    fc.assert(
      fc.property(fc.oneof(isoDate, fc.string()), (text) => {
        const out = formatDateWithWeekday(text);
        expect(out === "" || /^\d{4}\/\d{2}\/\d{2}（[日月火水木金土]）$/.test(out)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("lab properties", () => {
  it("groupLabResults partitions the object rows and series stay finite", () => {
    const row = fc.oneof(
      fc.record({
        date: isoDate,
        panel: fc.string(),
        item: fc.string(),
        valueNumber: fc.oneof(fc.integer(), fc.constant(null), fc.constant(Number.NaN), fc.string()),
        unit: fc.string(),
      }),
      fc.constant(null),
      fc.integer(),
    );
    fc.assert(
      fc.property(fc.array(row, { maxLength: 20 }), fc.string(), (rows, item) => {
        const objectRows = rows.filter((r) => r && typeof r === "object");
        const groups = groupLabResults(rows);
        expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(objectRows.length);
        for (const p of labItemSeries(rows, item)) {
          expect(Number.isFinite(p.value)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("share properties", () => {
  it("round-trips well-formed tokens through the share URL", () => {
    // The generator is narrowed to grapheme strings: a lone surrogate
    // cannot occur in a real location hash or a server-issued token,
    // and encodeURIComponent rejects it outright (same narrowing as
    // the music-admin share tests). The round-trip goes through the
    // built URL's hash fragment, because parseShareToken's contract —
    // and its only caller, the store — is a location.hash, not a full
    // URL (feeding it the whole URL makes even a single-space token
    // fail: the "share" key check compares against the URL prefix).
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (token) => {
        const url = buildShareUrl("https://example.com/health/", token);
        const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
        expect(parseShareToken(hash)).toBe(token);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("parseShareToken never throws on arbitrary hashes", () => {
    // Half the draws are biased into the share parameter itself, where
    // a malformed percent escape is what used to raise URIError.
    const hash = fc.oneof(
      fc.string(),
      fc.string().map((s) => `#share=${s}`),
    );
    fc.assert(
      fc.property(hash, (h) => {
        expect(typeof parseShareToken(h)).toBe("string");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
