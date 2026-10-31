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

export function formatKcal(value) {
  return `${formatInteger(value)} kcal`;
}

export function formatSigned(value, unit = "") {
  if (value === null || value === undefined) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatInteger(value)}${unit}`;
}

export function formatPercentChange(current, baseline) {
  if (current === null || current === undefined || !baseline) {
    return "-";
  }
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
