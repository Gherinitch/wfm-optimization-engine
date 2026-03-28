// store/storeTypes.ts
import {
  Agent,
  Segment,
  Requirement,
  PendingOverride,
  CustomRule,
  EditRecord,
  PendingSwap,
} from "@/types/wfm";

export interface CoreSlice {
  loadedDate: string | null;
  selectedDate: string;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  agents: Record<string, Agent>;
  segments: Record<string, Segment>;
  requirements: Record<string, Requirement>;
  rules: CustomRule[];
  originalSegments: Record<string, Segment>;
  edits: EditRecord[];
  zoomLevel: number;
  pixelsPerMinute: number;
  timelineStartMin: number;
  timelineEndMin: number;
  pendingOverride: PendingOverride | null;
  pendingSwap: PendingSwap | null;
  setPendingSwap: (swap: PendingSwap | null) => void;
  setPendingOverride: (override: PendingOverride | null) => void;
  setSelectedDate: (date: string) => void;
  setHydratedData: (
    date: string,
    agents: Record<string, Agent>,
    segments: Record<string, Segment>,
    requirements: Record<string, Requirement>,
    edits?: EditRecord[],
  ) => void;
  addRule: (rule: CustomRule) => void;
  updateRule: (id: string, updates: Partial<CustomRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  setZoomLevel: (zoom: number) => void;
  setTimelineBounds: (start: number, end: number) => void;
  autoFitBounds: () => void;
}

export interface MetricsSlice {
  dailyCoverage: number[];
  dailyScheduledMetrics: number;
  dailyRequiredMetrics: number;
  recalculateMetrics: () => void;
  getDailyMetrics: () => { dailyScheduled: number; dailyRequired: number };
  getAggregatedMetrics: (
    startMin: number,
    durationMins: number,
  ) => {
    scheduled: number;
    required: number;
    gst: number;
    varianceMins: number;
  };
}

export interface ActionSlice {
  shiftAgentDay: (agentId: string, date: string, offsetMins: number) => void;
  executeShiftSwap: (agentAId: string, agentBId: string, date: string) => void;
  executeThreeWaySwap: (
    agentAId: string,
    agentBId: string,
    agentCId: string,
    date: string,
  ) => void;
  updateSegmentTime: (id: string, newStart: number, newEnd: number) => void;
  assignSegmentToAgent: (segmentId: string, newAgentId: string) => void;
  confirmPendingOverride: () => void;
  revertEdit: (editId: string) => void;
  clearAllEdits: () => void;
  getSegmentViolations: (segmentId: string) => string[];
  checkHypotheticalViolations: (
    segmentId: string,
    newStartMin: number,
    newEndMin: number,
  ) => string[];
}

// Combine them into the master state!
export type ScheduleState = CoreSlice & MetricsSlice & ActionSlice;
