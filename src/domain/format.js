/** Number / unit formatting helpers (ja-JP). */

export function formatInteger(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return Math.round(value).toLocaleString("ja-JP");
}

export function formatDecimal(value, digits = 1) {
  if (value === null || value === undefined) {
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
  if (current === null || current === undefined || !baseline) {
    return "-";
  }
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Minutes -> "15時間20分" / "1時間" / "45分" / "0分". */
export function formatDurationMinutes(value) {
  if (value === null || value === undefined) {
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
