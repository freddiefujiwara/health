// Keep every label for short series; otherwise show every nth label.
export function selectBarTickLabels(points) {
  const step = points.length <= 8 ? 1 : Math.ceil(points.length / 6);
  return points.filter((_, index) => index % step === 0).map((point) => point.date);
}
