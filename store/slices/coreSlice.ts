// store/slices/coreSlice.ts
import { StateCreator } from "zustand";
import { ScheduleState, CoreSlice } from "../storeTypes";
import {
  DEFAULT_ZOOM_LEVEL,
  TIMELINE_START_MINUTES,
  TIMELINE_END_MINUTES,
  DEFAULT_RULES,
  MINS_PER_INTERVAL,
  MINS_PER_HOUR,
  MINS_PER_DAY,
} from "@/constants/wfm";

export const createCoreSlice: StateCreator<ScheduleState, [], [], CoreSlice> = (
  set,
  get,
) => ({
  loadedDate: null,
  selectedDate: "",
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  agents: {},
  segments: {},
  requirements: {},
  zoomLevel: DEFAULT_ZOOM_LEVEL,
  pixelsPerMinute: 4,
  timelineStartMin: TIMELINE_START_MINUTES,
  timelineEndMin: TIMELINE_END_MINUTES,
  pendingOverride: null,
  originalSegments: {},
  edits: [],
  pastStates: [],
  futureStates: [],
  isOptimizing: false,
  setIsOptimizing: (val) => set({ isOptimizing: val }),
  optimizationProgress: 0,
  setOptimizationProgress: (val) => set({ optimizationProgress: val }),
  pendingSwap: null,
  pendingIntradayOptimization: null,
  setPendingIntradayOptimization: (opt) =>
    set({ pendingIntradayOptimization: opt }),
  pendingInterdayOptimization: null,
  setPendingInterdayOptimization: (opt) =>
    set({ pendingInterdayOptimization: opt }),

  // Default WFM Rules
  rules: DEFAULT_RULES,

  setPendingSwap: (swap) => set({ pendingSwap: swap }),
  setPendingOverride: (override) => set({ pendingOverride: override }),

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().recalculateMetrics();
  },

  setHydratedData: (date, agents, segments, requirements, edits = []) => {
    set({
      loadedDate: date,
      selectedDate: date,
      agents,
      segments,
      originalSegments: JSON.parse(JSON.stringify(segments)),
      requirements,
      edits,
    });
    get().recalculateMetrics();
  },

  addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
  updateRule: (id, updates) =>
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  deleteRule: (id) =>
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) })),
  toggleRule: (id) =>
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === id ? { ...r, isActive: !r.isActive } : r,
      ),
    })),

  setZoomLevel: (zoomLevel) => {
    let ppm = 2;
    if (zoomLevel === MINS_PER_INTERVAL) ppm = 4;
    else if (zoomLevel === 30) ppm = 3;
    else if (zoomLevel === MINS_PER_HOUR) ppm = 2;
    set({ zoomLevel, pixelsPerMinute: ppm });
  },

  setTimelineBounds: (timelineStartMin, timelineEndMin) =>
    set({ timelineStartMin, timelineEndMin }),

  autoFitBounds: () =>
    set((state) => {
      const todaysSegments = Object.values(state.segments).filter(
        (seg) => seg.date === state.selectedDate,
      );
      if (todaysSegments.length === 0)
        return { timelineStartMin: 480, timelineEndMin: 1080 };

      let min = MINS_PER_DAY,
        max = 0;
      todaysSegments.forEach((seg) => {
        if (seg.startMin < min) min = seg.startMin;
        if (seg.endMin > max) max = seg.endMin;
      });

      return {
        timelineStartMin: Math.max(
          0,
          Math.floor(min / MINS_PER_HOUR) * MINS_PER_HOUR - MINS_PER_HOUR,
        ),
        timelineEndMin: Math.min(
          MINS_PER_DAY,
          Math.ceil(max / MINS_PER_HOUR) * MINS_PER_HOUR + MINS_PER_HOUR,
        ),
      };
    }),
});
