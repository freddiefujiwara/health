/** Helpers for the lab_results sheet (long-format lab data). */

/** Group rows by date (newest first), keeping the row order within a date. */
export function groupLabResults(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.date)) {
      groups.set(row.date, { date: row.date, panel: row.panel, rows: [] });
    }
    groups.get(row.date).rows.push(row);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Items that have at least two numeric measurements, in first-seen order. */
export function numericLabItems(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (row.valueNumber !== null && row.valueNumber !== undefined) {
      counts.set(row.item, (counts.get(row.item) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([item]) => item);
}

/** Time series points for one item (numeric values only, date ascending). */
export function labItemSeries(rows, item) {
  return rows
    .filter((row) => row.item === item && row.valueNumber !== null && row.valueNumber !== undefined)
    .map((row) => ({ date: row.date, value: row.valueNumber }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Unit of the most recent row for an item ("" when unknown). */
export function labItemUnit(rows, item) {
  const series = rows.filter((row) => row.item === item);
  return series.length ? (series[series.length - 1].unit ?? "") : "";
}

/** Items worth watching (frequently flagged or clinically relevant for this user). */
export const FEATURED_LAB_ITEMS = [
  "γ-GTP",
  "ALT",
  "AST",
  "クレアチニン",
  "eGFR",
  "C反応性蛋白",
  "中性脂肪",
  "グルコース",
];

/** Chart-ready series for the featured items that have at least two numeric points. */
export function featuredLabSeries(rows) {
  return FEATURED_LAB_ITEMS.map((item) => ({
    item,
    unit: labItemUnit(rows, item),
    points: labItemSeries(rows, item),
  })).filter((entry) => entry.points.length >= 2);
}
