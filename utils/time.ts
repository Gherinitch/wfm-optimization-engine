export const MINS_PER_DAY = 1440;
export const PIXELS_PER_MINUTE = 2;

export const minToPx = (min: number) => min * PIXELS_PER_MINUTE;
export const pxToMin = (px: number) => Math.round(px / PIXELS_PER_MINUTE);

export const formatTime = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// NEW: Float formatter for max 2 decimals
export const formatMetric = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Number(val.toFixed(2));
};
