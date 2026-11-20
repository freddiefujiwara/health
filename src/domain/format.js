/** Number / unit formatting helpers (ja-JP). */

// Same contract as formatChartValue below: anything that is not a
// finite number renders as the missing-value dash, so a deformed
// value can never surface as "NaN", "Infinity" or "[object Object]".
const isFormattable = (value) => typeof value === "number" && Number.isFinite(value);

export function formatInteger(value) {
  if (!isFormattable(value)) {
    return "-";
  }
  return Math.round(value).toLocaleString("ja-JP");
}

export function formatDecimal(value, digits = 1) {
  if (!isFormattable(value)) {
    return "-";
  }
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatKg(value) {
  return `${formatDecimal(value)} kg`;
}

export function formatPercentChange(current, baseline) {
  if (!isFormattable(current) || !baseline) {
    return "-";
  }
  const pct = ((current - baseline) / baseline) * 100;
  if (!Number.isFinite(pct)) {
    return "-";
  }
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Minutes -> "15時間20分" / "1時間" / "45分" / "0分". */
export function formatDurationMinutes(value) {
  if (!isFormattable(value)) {
    return "-";
  }
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) {
    return `${minutes}分`;
  }
  if (minutes === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${minutes}分`;
}

/** Tooltip value: integers grouped, decimals up to 2 places. */
export function formatChartValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString("ja-JP");
  }
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-11-12" -> "2026/11/12（木）". Returns "" for empty or invalid input. */
export function formatDateWithWeekday(date) {
  if (typeof date !== "string" || !date) {
    return "";
  }
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return "";
  }
  const [y, m, d] = parts;
  const parsed = new Date(y, m - 1, d);
  // Reject roll-overs such as "2026-02-30" (which Date reads as Mar 2).
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    return "";
  }
  const weekday = WEEKDAYS_JA[parsed.getDay()];
  return `${date.replaceAll("-", "/")}（${weekday}）`;
}
