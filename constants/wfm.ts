// constants/wfm.ts
import { Rule } from "../types/wfm";

// Time constants
export const MINS_PER_HOUR = 60;
export const MINS_PER_DAY = 1440;
export const MINS_PER_INTERVAL = 15;
export const DEFAULT_ZOOM_LEVEL = 15;
export const MIN_WORK_GAP_MINUTES = 660;

// WFM Segment Categories
export const SEGMENT_CATEGORIES: readonly string[] = [
  "Work",
  "Break",
  "Lunch",
  "Meeting",
  "Absence",
] as const;

export type SegmentCategory = (typeof SEGMENT_CATEGORIES)[number];

// WFM Rule Blueprints
export const RULE_BLUEPRINTS: readonly {
  value: string;
  label: string;
}[] = [
  { value: "MAX_DURATION", label: "Maximum Duration limit" },
  { value: "CONTAINMENT", label: "Must be inside another segment" },
  { value: "MIN_WORK_BEFORE", label: "Minimum time before segment starts" },
  { value: "MIN_GAP", label: "Minimum gap between two segments" },
] as const;

export type RuleBlueprint = (typeof RULE_BLUEPRINTS)[number]["value"];

// Default WFM Rules
export const DEFAULT_RULES: Rule[] = [
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
    name: "60 Min Before First Break",
    isActive: true,
    blueprint: "MIN_WORK_BEFORE",
    targetCategory: "Break",
    referenceCategory: "Work",
    valueMinutes: 60,
  },
  {
    id: "rule_5",
    name: "60 Min Before Lunch",
    isActive: true,
    blueprint: "MIN_WORK_BEFORE",
    targetCategory: "Lunch",
    referenceCategory: "Work",
    valueMinutes: 60,
  },
];

// Time Constants
export const HOURS_IN_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_IN_DAY = MINUTES_PER_HOUR * HOURS_IN_DAY; // 1440

// Timeline Defaults
export const DEFAULT_TIMELINE_LENGTH = 25; // 25 hours for display
export const TIMELINE_START_HOUR = 6; // 6:00 AM
export const TIMELINE_END_HOUR = 23; // 11:00 PM
export const TIMELINE_START_MINUTES = TIMELINE_START_HOUR * MINUTES_PER_HOUR; // 360
export const TIMELINE_END_MINUTES = TIMELINE_END_HOUR * MINUTES_PER_HOUR; // 1380
