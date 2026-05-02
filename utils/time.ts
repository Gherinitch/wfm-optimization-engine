import { MINS_PER_DAY, MINS_PER_HOUR } from "@/constants/wfm";

export const PIXELS_PER_MINUTE = 2;

export const minToPx = (min: number) => min * PIXELS_PER_MINUTE;
export const pxToMin = (px: number) => Math.round(px / PIXELS_PER_MINUTE);

export const formatTime = (min: number) => {
  const normalized = ((min % MINS_PER_DAY) + MINS_PER_DAY) % MINS_PER_DAY;
  const h = Math.floor(normalized / MINS_PER_HOUR);
  const m = normalized % MINS_PER_HOUR;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// NEW: Float formatter for max 2 decimals
export const formatMetric = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Number(val.toFixed(2));
};
