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

export interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  blueprint: RuleBlueprint;
  targetCategory: SegmentCategory;
  referenceCategory?: SegmentCategory;
  valueMinutes: number;
}

// CustomRule is an alias for Rule, used in constraint engine
export type CustomRule = Rule;

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

// Database row interfaces
export interface DbAgentRow {
  id: string;
  name: string;
}

export interface DbSegmentRow {
  id: string;
  agent_id: string;
  name: string;
  category: string;
  is_general: boolean;
  is_paid: boolean;
  date: string;
  start_min: number;
  end_min: number;
  rank: number;
}

export interface DbRequirementRow {
  id: string;
  date: string;
  time_min: number;
  req: number;
}

export interface DbEditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: string | null;
  new_data: string | null;
  timestamp: number;
}

export interface DbShiftRow {
  id: string;
  agent_id: string;
  date: string;
  start_min: number;
  end_min: number;
}

export interface DbMetricRow {
  date: string;
  scheduled: number;
  required: number;
  coverage: number;
  status: string;
  is_actionable: number;
}

export interface DbAdjacentSegmentRow {
  id: string;
  agent_id: string;
  date: string;
  start_min: number;
  end_min: number;
  rank: number;
}

// Database query parameter type
export type DbQueryParams = (
  | string
  | number
  | boolean
  | null
  | (string | number)[]
)[];

// Database query result interfaces
export interface DbShiftSummaryRow {
  agent_id: string;
  date: string;
  start_min: number;
  end_min: number;
}
