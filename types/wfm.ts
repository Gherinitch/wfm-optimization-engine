// types/wfm.ts

export type SegmentCategory =
  | "Work"
  | "Break"
  | "Lunch"
  | "Meeting"
  | "Absence";

export interface Segment {
  id: string;
  agentId: string;
  name: string;
  category: SegmentCategory;
  isGeneral: boolean;
  isPaid: boolean;
  date: string;
  startMin: number;
  endMin: number;
  rank: number;
}

export interface Agent {
  id: string;
  name: string;
  segments: string[];
}

export interface Requirement {
  date: string;
  timeMin: number;
  req: number;
}

export interface PendingOverride {
  segmentId: string;
  newStart: number;
  newEnd: number;
  violations: string[];
}

export type RuleBlueprint =
  | "MAX_DURATION"
  | "CONTAINMENT"
  | "MIN_WORK_BEFORE"
  | "MIN_GAP";

export interface CustomRule {
  id: string;
  name: string;
  isActive: boolean;
  blueprint: RuleBlueprint;
  targetCategory: SegmentCategory;
  referenceCategory?: SegmentCategory;
  valueMinutes: number;
}

export type EditType = "TIME_CHANGE" | "REASSIGNMENT" | "DATE_CHANGE";

export interface EditRecord {
  id: string;
  segmentId: string;
  segmentName: string;
  type: EditType;
  oldStartMin: number;
  newStartMin: number;
  oldEndMin: number;
  newEndMin: number;
  timestamp: number;
}

export interface PendingSwap {
  sourceAgentId: string;
  targetAgentId: string | null; // <-- Make this nullable
  date: string;
}

export interface IntradayMove {
  segmentId: string;
  newStart: number;
  newEnd: number;
}

export interface InterdayMove {
  agentId: string;
  oldDate: string;
  newDate: string;
}
