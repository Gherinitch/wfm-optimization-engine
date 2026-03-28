// store/useScheduleStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ScheduleState } from "./storeTypes";
import { createCoreSlice } from "./slices/coreSlice";
import { createMetricsSlice } from "./slices/metricsSlice";
import { createActionSlice } from "./slices/actionSlice";

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (...args) => ({
      ...createCoreSlice(...args),
      ...createMetricsSlice(...args),
      ...createActionSlice(...args),
    }),
    {
      name: "wfm-schedule-storage",
      version: 6,
      migrate: (persistedState: any, version: number) => {
        // Fallback for older versions wiping rules
        if (version < 6) {
          persistedState.rules = [
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
          ];
        }
        return persistedState;
      },
      partialize: (state) => ({
        rules: state.rules,
        zoomLevel: state.zoomLevel,
      }),
    },
  ),
);
