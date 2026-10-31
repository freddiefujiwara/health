import { describe, expect, it } from "vitest";
import {
  formatDecimal,
  formatInteger,
  formatKcal,
  formatKg,
  formatPercentChange,
  formatSigned,
} from "./format";

describe("format helpers", () => {
  it("formats integers with ja-JP grouping and dash for missing values", () => {
    expect(formatInteger(12345)).toBe("12,345");
    expect(formatInteger(1234.6)).toBe("1,235");
    expect(formatInteger(null)).toBe("-");
    expect(formatInteger(undefined)).toBe("-");
  });

  it("formats decimals with fixed digits", () => {
    expect(formatDecimal(91.5)).toBe("91.5");
    expect(formatDecimal(10.59, 2)).toBe("10.59");
    expect(formatDecimal(null)).toBe("-");
    expect(formatDecimal(undefined)).toBe("-");
  });

  it("formats units", () => {
    expect(formatKg(91.5)).toBe("91.5 kg");
    expect(formatKg(null)).toBe("- kg");
    expect(formatKcal(2000)).toBe("2,000 kcal");
  });

  it("formats signed values", () => {
    expect(formatSigned(500)).toBe("+500");
    expect(formatSigned(-936, " kcal")).toBe("-936 kcal");
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(null)).toBe("-");
    expect(formatSigned(undefined)).toBe("-");
  });

  it("formats percent change", () => {
    expect(formatPercentChange(91.5, 99.7)).toBe("-8.2%");
    expect(formatPercentChange(110, 100)).toBe("+10.0%");
    expect(formatPercentChange(null, 100)).toBe("-");
    expect(formatPercentChange(90, null)).toBe("-");
    expect(formatPercentChange(90, 0)).toBe("-");
  });
});
