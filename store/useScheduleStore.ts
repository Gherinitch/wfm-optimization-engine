// store/useScheduleStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calculateNetEdits, runConstraintEngine } from "@/utils/engine";
import {
  Agent,
  Segment,
  Requirement,
  PendingOverride,
  CustomRule,
  EditRecord,
  PendingSwap,
} from "@/types/wfm";

interface ScheduleState {
  loadedDate: string | null;
  selectedDate: string;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  agents: Record<string, Agent>;
  segments: Record<string, Segment>;
  requirements: Record<string, Requirement>;

  zoomLevel: number;
  pixelsPerMinute: number;
  timelineStartMin: number;
  timelineEndMin: number;

  pendingOverride: PendingOverride | null;
  rules: CustomRule[];
  originalSegments: Record<string, Segment>;
  edits: EditRecord[];

  pendingSwap: PendingSwap | null;
  setPendingSwap: (swap: PendingSwap | null) => void;
  executeShiftTransfer: (
    sourceAgentId: string,
    targetAgentId: string,
    date: string,
  ) => void;
  executeShiftSwap: (agentAId: string, agentBId: string, date: string) => void;

  // NEW: Cached Coverage Maps
  dailyCoverage: number[];
  dailyScheduledMetrics: number;
  dailyRequiredMetrics: number;
  recalculateMetrics: () => void;

  setSelectedDate: (date: string) => void;
  setHydratedData: (
    date: string,
    agents: Record<string, Agent>,
    segments: Record<string, Segment>,
    requirements: Record<string, Requirement>,
  ) => void;
  addRule: (rule: CustomRule) => void;
  updateRule: (id: string, updates: Partial<CustomRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  updateSegmentTime: (id: string, newStart: number, newEnd: number) => void;
  assignSegmentToAgent: (segmentId: string, newAgentId: string) => void;
  setZoomLevel: (zoom: number) => void;
  setTimelineBounds: (start: number, end: number) => void;
  autoFitBounds: () => void;
  setPendingOverride: (override: PendingOverride | null) => void;
  confirmPendingOverride: () => void;
  revertEdit: (editId: string) => void;
  clearAllEdits: () => void;

  getDailyMetrics: () => { dailyScheduled: number; dailyRequired: number };
  getAggregatedMetrics: (
    startMin: number,
    durationMins: number,
  ) => { scheduled: number; required: number; gst: number };
  getSegmentViolations: (segmentId: string) => string[];
  checkHypotheticalViolations: (
    segmentId: string,
    newStartMin: number,
    newEndMin: number,
  ) => string[];
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
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

      rules: [
        {
          id: "rule_1",
          name: "Standard 10h Shift Limit",
          isActive: true,
          blueprint: "MAX_DURATION",
          targetCategory: "Work",
          valueMinutes: 600,
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
          name: "2h Work Before Break",
          isActive: true,
          blueprint: "MIN_WORK_BEFORE",
          targetCategory: "Break",
          referenceCategory: "Work",
          valueMinutes: 120,
        },
        {
          id: "rule_5",
          name: "4h Split Shift Rest",
          isActive: true,
          blueprint: "MIN_GAP",
          targetCategory: "Work",
          referenceCategory: "Work",
          valueMinutes: 240,
        },
      ],

      pendingSwap: null,
      setPendingSwap: (swap) => set({ pendingSwap: swap }),

      // FIXED: O(1) Pre-computed coverage array
      dailyCoverage: new Array(1440).fill(0),
      dailyScheduledMetrics: 0,
      dailyRequiredMetrics: 0,

      recalculateMetrics: () =>
        set((state) => {
          const coverage = new Array(1440).fill(0);
          let dailyScheduled = 0;

          Object.values(state.segments).forEach((seg) => {
            if (
              !seg.isGeneral &&
              seg.category === "Work" &&
              seg.date === state.selectedDate
            ) {
              const start = Math.max(0, seg.startMin);
              const end = Math.min(1440, seg.endMin);
              for (let m = start; m < end; m++) {
                coverage[m]++;
              }
              dailyScheduled += (seg.endMin - seg.startMin) / 15;
            }
          });

          let dailyRequired = 0;
          Object.values(state.requirements).forEach((r) => {
            if (r.date === state.selectedDate) dailyRequired += r.req;
          });

          return {
            dailyCoverage: coverage,
            dailyScheduledMetrics: dailyScheduled,
            dailyRequiredMetrics: dailyRequired,
          };
        }),

      executeShiftTransfer: (sourceAgentId, targetAgentId, date) => {
        set((state) => {
          const sourceAgent = state.agents[sourceAgentId];
          const targetAgent = state.agents[targetAgentId];
          if (!sourceAgent || !targetAgent) return state;

          const segmentsToMove = sourceAgent.segments.filter(
            (id) => state.segments[id]?.date === date,
          );
          if (segmentsToMove.length === 0) return state;

          const newSegmentsObj = { ...state.segments };
          const newEdits = [...state.edits];

          segmentsToMove.forEach((id) => {
            newSegmentsObj[id] = {
              ...newSegmentsObj[id],
              agentId: targetAgentId,
            };
            newEdits.unshift({
              id: `edit_${Date.now()}_${id}`,
              segmentId: id,
              segmentName: newSegmentsObj[id].name,
              type: "REASSIGNMENT",
              oldStartMin: newSegmentsObj[id].startMin,
              newStartMin: newSegmentsObj[id].startMin,
              oldEndMin: newSegmentsObj[id].endMin,
              newEndMin: newSegmentsObj[id].endMin,
              timestamp: Date.now(),
            });
          });

          return {
            segments: newSegmentsObj,
            edits: newEdits,
            agents: {
              ...state.agents,
              [sourceAgentId]: {
                ...sourceAgent,
                segments: sourceAgent.segments.filter(
                  (id) => !segmentsToMove.includes(id),
                ),
              },
              [targetAgentId]: {
                ...targetAgent,
                segments: [...targetAgent.segments, ...segmentsToMove],
              },
            },
            pendingSwap: null,
          };
        });
        get().recalculateMetrics();
      },

      executeShiftSwap: (agentAId, agentBId, date) => {
        set((state) => {
          const agentA = state.agents[agentAId];
          const agentB = state.agents[agentBId];
          if (!agentA || !agentB) return state;

          const aSegments = agentA.segments.filter(
            (id) => state.segments[id]?.date === date,
          );
          const bSegments = agentB.segments.filter(
            (id) => state.segments[id]?.date === date,
          );

          const newSegmentsObj = { ...state.segments };
          const newEdits = [...state.edits];

          aSegments.forEach((id) => {
            newSegmentsObj[id] = { ...newSegmentsObj[id], agentId: agentBId };
            newEdits.unshift({
              id: `edit_${Date.now()}_${id}`,
              segmentId: id,
              segmentName: newSegmentsObj[id].name,
              type: "REASSIGNMENT",
              oldStartMin: newSegmentsObj[id].startMin,
              newStartMin: newSegmentsObj[id].startMin,
              oldEndMin: newSegmentsObj[id].endMin,
              newEndMin: newSegmentsObj[id].endMin,
              timestamp: Date.now(),
            });
          });

          bSegments.forEach((id) => {
            newSegmentsObj[id] = { ...newSegmentsObj[id], agentId: agentAId };
            newEdits.unshift({
              id: `edit_${Date.now()}_${id}`,
              segmentId: id,
              segmentName: newSegmentsObj[id].name,
              type: "REASSIGNMENT",
              oldStartMin: newSegmentsObj[id].startMin,
              newStartMin: newSegmentsObj[id].startMin,
              oldEndMin: newSegmentsObj[id].endMin,
              newEndMin: newSegmentsObj[id].endMin,
              timestamp: Date.now(),
            });
          });

          return {
            segments: newSegmentsObj,
            edits: newEdits,
            agents: {
              ...state.agents,
              [agentAId]: {
                ...agentA,
                segments: [
                  ...agentA.segments.filter((id) => !aSegments.includes(id)),
                  ...bSegments,
                ],
              },
              [agentBId]: {
                ...agentB,
                segments: [
                  ...agentB.segments.filter((id) => !bSegments.includes(id)),
                  ...aSegments,
                ],
              },
            },
            pendingSwap: null,
          };
        });
        get().recalculateMetrics();
      },

      setSelectedDate: (date) => {
        set({ selectedDate: date });
        get().recalculateMetrics();
      },

      setHydratedData: (date, agents, segments, requirements) => {
        set({
          loadedDate: date,
          selectedDate: date,
          agents,
          segments,
          originalSegments: JSON.parse(JSON.stringify(segments)),
          requirements,
          edits: [],
        });
        get().recalculateMetrics();
      },

      addRule: (rule) => set((state) => ({ rules: [...state.rules, rule] })),
      updateRule: (id, updates) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        })),
      deleteRule: (id) =>
        set((state) => ({ rules: state.rules.filter((r) => r.id !== id) })),
      toggleRule: (id) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, isActive: !r.isActive } : r,
          ),
        })),

      updateSegmentTime: (id, newStart, newEnd) => {
        set((state) => {
          const segment = state.segments[id];
          if (!segment) return state;
          const newEdits = calculateNetEdits(
            state.edits,
            id,
            segment.name,
            segment.startMin,
            segment.endMin,
            newStart,
            newEnd,
          );
          return {
            segments: {
              ...state.segments,
              [id]: { ...segment, startMin: newStart, endMin: newEnd },
            },
            edits: newEdits,
          };
        });
        get().recalculateMetrics();
      },

      assignSegmentToAgent: (segmentId, newAgentId) => {
        set((state) => {
          const segment = state.segments[segmentId];
          if (!segment || segment.agentId === newAgentId) return state;
          const oldAgentId = segment.agentId;
          return {
            agents: {
              ...state.agents,
              [oldAgentId]: {
                ...state.agents[oldAgentId],
                segments: state.agents[oldAgentId].segments.filter(
                  (id) => id !== segmentId,
                ),
              },
              [newAgentId]: {
                ...state.agents[newAgentId],
                segments: [...state.agents[newAgentId].segments, segmentId],
              },
            },
            segments: {
              ...state.segments,
              [segmentId]: { ...segment, agentId: newAgentId },
            },
          };
        });
        get().recalculateMetrics();
      },

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
          let min = 1440;
          let max = 0;
          todaysSegments.forEach((seg) => {
            if (seg.startMin < min) min = seg.startMin;
            if (seg.endMin > max) max = seg.endMin;
          });
          const start = Math.max(0, Math.floor(min / 60) * 60 - 60);
          const end = Math.min(1440, Math.ceil(max / 60) * 60 + 60);
          return { timelineStartMin: start, timelineEndMin: end };
        }),

      setPendingOverride: (override) => set({ pendingOverride: override }),

      confirmPendingOverride: () => {
        set((state) => {
          if (!state.pendingOverride) return state;
          const { segmentId, newStart, newEnd } = state.pendingOverride;
          const segment = state.segments[segmentId];
          if (!segment) return { pendingOverride: null };
          const newEdits = calculateNetEdits(
            state.edits,
            segmentId,
            segment.name,
            segment.startMin,
            segment.endMin,
            newStart,
            newEnd,
          );
          return {
            segments: {
              ...state.segments,
              [segmentId]: { ...segment, startMin: newStart, endMin: newEnd },
            },
            edits: newEdits,
            pendingOverride: null,
          };
        });
        get().recalculateMetrics();
      },

      revertEdit: (editId) => {
        set((state) => {
          const edit = state.edits.find((e) => e.id === editId);
          if (!edit) return state;
          const segment = state.segments[edit.segmentId];
          if (!segment) return state;
          return {
            segments: {
              ...state.segments,
              [edit.segmentId]: {
                ...segment,
                startMin: edit.oldStartMin,
                endMin: edit.oldEndMin,
              },
            },
            edits: state.edits.filter((e) => e.id !== editId),
          };
        });
        get().recalculateMetrics();
      },

      clearAllEdits: () => {
        set((state) => ({
          segments: JSON.parse(JSON.stringify(state.originalSegments)),
          edits: [],
        }));
        get().recalculateMetrics();
      },

      getDailyMetrics: () => {
        const state = get();
        return {
          dailyScheduled: state.dailyScheduledMetrics,
          dailyRequired: state.dailyRequiredMetrics,
        };
      },

      // FIXED: Uses O(1) dailyCoverage array rather than O(N^2) segment loops
      getAggregatedMetrics: (startMin, durationMins) => {
        const state = get();
        const intervals = Math.max(1, durationMins / 15);
        let totalScheduled = 0;
        let totalRequired = 0;

        for (let i = 0; i < intervals; i++) {
          const t = startMin + i * 15;
          totalScheduled += state.dailyCoverage[t] || 0;
          totalRequired +=
            state.requirements[`${state.selectedDate}_${t}`]?.req || 0;
        }

        const avgScheduled = totalScheduled / intervals;
        const avgRequired = totalRequired / intervals;
        const gst =
          avgRequired > 0 && state.dailyRequiredMetrics > 0
            ? avgScheduled /
              avgRequired /
              (state.dailyScheduledMetrics / state.dailyRequiredMetrics)
            : 1;

        return { scheduled: avgScheduled, required: avgRequired, gst };
      },

      getSegmentViolations: (segmentId: string) => {
        const state = get();
        const segment = state.segments[segmentId];
        if (!segment) return [];
        return runConstraintEngine(
          segmentId,
          segment.startMin,
          segment.endMin,
          state.segments,
          state.agents,
          state.rules,
        );
      },

      checkHypotheticalViolations: (
        segmentId: string,
        newStartMin: number,
        newEndMin: number,
      ) => {
        const state = get();
        return runConstraintEngine(
          segmentId,
          newStartMin,
          newEndMin,
          state.segments,
          state.agents,
          state.rules,
        );
      },
    }),
    {
      name: "wfm-schedule-storage",
      partialize: (state) => ({
        rules: state.rules,
        zoomLevel: state.zoomLevel,
      }),
    },
  ),
);
