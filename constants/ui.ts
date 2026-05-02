// constants/ui.ts
// Z-index values for UI layering

export const Z_INDEX = {
  // Base layer
  BASE: 0,

  // Table elements
  TABLE_CELL_HOVER: 50,
  TABLE_STICKY_LEFT: 60,
  TABLE_STICKY_HEADER: 50,

  // Timeline headers
  TIMELINE_STICKY_LEFT: 100000,
  TIMELINE_STICKY_HEADER: 100001,

  // Modals and panels
  MODAL_BACKDROP: 999,
  MODAL_OVERLAY: 999999,
  PANEL_BACKDROP: 100000,
  PANEL_OVERLAY: 100001,
  WEEKLY_MODAL: 200000,
  INTRADAY_OPTIMIZER: 999999,

  // Tooltips
  TOOLTIP: 100,
} as const;
