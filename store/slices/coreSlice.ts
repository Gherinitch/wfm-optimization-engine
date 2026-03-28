// store/slices/coreSlice.ts
import { StateCreator } from "zustand";
import { ScheduleState, CoreSlice } from "../storeTypes";

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
  zoomLevel: 15,
  pixelsPerMinute: 4,
  timelineStartMin: 360,
  timelineEndMin: 1380,
  pendingOverride: null,
  originalSegments: {},
  edits: [],
  pendingSwap: null,

  // Default WFM Rules
  rules: [
    {
      id: "rule_5",
      name: "11h Minimum Break Between Shifts",
      isActive: true,
      blueprint: "MIN_GAP",
      targetCategory: "Work",
      referenceCategory: "Work",
      valueMinutes: 660,
    },
    {
      id: "rule_2",
      name: "Breaks Must Be Inside Work",
      isActive: true,
      blueprint: "CONTAINMENT",
      targetCategory: "Break",
      referenceCategory: "Work",
      valueMinutes: 0,
    },
    {
      id: "rule_3",
      name: "Lunches Must Be Inside Work",
      isActive: true,
      blueprint: "CONTAINMENT",
      targetCategory: "Lunch",
      referenceCategory: "Work",
      valueMinutes: 0,
    },
    {
      id: "rule_4",
      name: "1.5h Work Before Break",
      isActive: true,
      blueprint: "MIN_WORK_BEFORE",
      targetCategory: "Break",
      referenceCategory: "Work",
      valueMinutes: 90,
    },
    {
      id: "rule_5",
      name: "1.5h Work Between Break",
      isActive: true,
      blueprint: "MIN_WORK_BEFORE",
      targetCategory: "Break",
      referenceCategory: "Work",
      valueMinutes: 90,
    },
    {
      id: "rule_6",
      name: "Maximum Shift Duration",
      isActive: true,
      blueprint: "MAX_DURATION",
      targetCategory: "Work",
      valueMinutes: 660,
    },
  ],

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
    if (zoomLevel === 15) ppm = 4;
    else if (zoomLevel === 30) ppm = 3;
    else if (zoomLevel === 60) ppm = 2;
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

      let min = 1440,
        max = 0;
      todaysSegments.forEach((seg) => {
        if (seg.startMin < min) min = seg.startMin;
        if (seg.endMin > max) max = seg.endMin;
      });

      return {
        timelineStartMin: Math.max(0, Math.floor(min / 60) * 60 - 60),
        timelineEndMin: Math.min(1440, Math.ceil(max / 60) * 60 + 60),
      };
    }),
});
