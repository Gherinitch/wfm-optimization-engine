// store/useScheduleStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ScheduleState } from "./storeTypes";
import { createCoreSlice } from "./slices/coreSlice";
import { createMetricsSlice } from "./slices/metricsSlice";
import { createActionSlice } from "./slices/actionSlice";
import { MIN_WORK_GAP_MINUTES } from "@/constants/wfm";

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (...args) => ({
      ...createCoreSlice(...args),
      ...createMetricsSlice(...args),
      ...createActionSlice(...args),
    }),
    {
      name: "wfm-schedule-storage",
      version: 8,
      migrate: (persistedState, version: number) => {
        // Force-refresh rules on any version older than 8
        if (persistedState && version < 8) {
          const rules = [
            {
              id: "rule_1",
              name: "11h Minimum Break Between Shifts",
              isActive: true,
              blueprint: "MIN_GAP",
              targetCategory: "Work",
              referenceCategory: "Work",
              valueMinutes: MIN_WORK_GAP_MINUTES,
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
              blueprint: "MIN_GAP",
              targetCategory: "Break",
              referenceCategory: "Break",
              valueMinutes: 90,
            },
            {
              id: "rule_6",
              name: "Maximum Shift Duration",
              isActive: true,
              blueprint: "MAX_DURATION",
              targetCategory: "Work",
              valueMinutes: MIN_WORK_GAP_MINUTES,
            },
            {
              id: "rule_7",
              name: "1.5h Work Before Lunch",
              isActive: true,
              blueprint: "MIN_WORK_BEFORE",
              targetCategory: "Lunch",
              referenceCategory: "Work",
              valueMinutes: 90,
            },
            {
              id: "rule_8",
              name: "1.5h Gap Between Break and Lunch",
              isActive: true,
              blueprint: "MIN_GAP",
              targetCategory: "Break",
              referenceCategory: "Lunch",
              valueMinutes: 90,
            },
            {
              id: "rule_9",
              name: "1.5h Gap Between Lunch and Break",
              isActive: true,
              blueprint: "MIN_GAP",
              targetCategory: "Lunch",
              referenceCategory: "Break",
              valueMinutes: 90,
            },
          ];
          return { ...persistedState, rules };
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
