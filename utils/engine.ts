// utils/engine.ts

import { EditRecord, Segment, Agent, CustomRule } from "@/types/wfm";

// FIXED: Caching date objects so the drag engine doesn't destroy memory allocation
const dateCache = new Map<string, number>();

export function getAbsoluteMinutes(
  dateStr: string,
  minutesFromMidnight: number,
): number {
  if (!dateCache.has(dateStr)) {
    dateCache.set(
      dateStr,
      Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 60000),
    );
  }
  return dateCache.get(dateStr)! + minutesFromMidnight;
}

const formatTime = (mins: number) => {
  const normalized = mins % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export function calculateNetEdits(
  edits: EditRecord[],
  segmentId: string,
  segmentName: string,
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): EditRecord[] {
  const existingEditIndex = edits.findIndex(
    (e) => e.segmentId === segmentId && e.type === "TIME_CHANGE",
  );
  let newEdits = [...edits];

  if (existingEditIndex >= 0) {
    const existingEdit = newEdits[existingEditIndex];
    if (
      newStart === existingEdit.oldStartMin &&
      newEnd === existingEdit.oldEndMin
    ) {
      newEdits.splice(existingEditIndex, 1);
    } else {
      newEdits[existingEditIndex] = {
        ...existingEdit,
        newStartMin: newStart,
        newEndMin: newEnd,
        timestamp: Date.now(),
      };
      const [movedEdit] = newEdits.splice(existingEditIndex, 1);
      newEdits.unshift(movedEdit);
    }
  } else {
    if (newStart !== oldStart || newEnd !== oldEnd) {
      newEdits.unshift({
        id: `edit_${Date.now()}`,
        segmentId,
        segmentName,
        type: "TIME_CHANGE",
        oldStartMin: oldStart,
        newStartMin: newStart,
        oldEndMin: oldEnd,
        newEndMin: newEnd,
        timestamp: Date.now(),
      });
    }
  }
  return newEdits;
}

export function runConstraintEngine(
  segmentId: string,
  newStartMin: number,
  newEndMin: number,
  segments: Record<string, Segment>,
  agents: Record<string, Agent>,
  rules: CustomRule[],
): string[] {
  const segment = segments[segmentId];
  if (!segment || segment.isGeneral) return [];

  const violations: string[] = [];
  const agent = agents[segment.agentId];
  const agentSegments = agent.segments
    .map((id) => segments[id])
    .filter(Boolean);

  const proposedAbsStart = getAbsoluteMinutes(segment.date, newStartMin);
  const proposedAbsEnd = getAbsoluteMinutes(segment.date, newEndMin);
  const proposedDuration = newEndMin - newStartMin;

  agentSegments.forEach((other) => {
    if (other.id === segment.id || other.isGeneral) return;

    const otherAbsStart = getAbsoluteMinutes(other.date, other.startMin);
    const otherAbsEnd = getAbsoluteMinutes(other.date, other.endMin);

    const overlaps =
      Math.max(proposedAbsStart, otherAbsStart) <
      Math.min(proposedAbsEnd, otherAbsEnd);

    if (overlaps) {
      const timeStr = `${formatTime(other.startMin)} - ${formatTime(other.endMin)}`;

      if (segment.category === "Work" && other.category === "Work") {
        violations.push(
          `Overlaps with another Work shift (${other.name}) on ${other.date} from ${timeStr}.`,
        );
      }
      if (
        segment.category !== "Work" &&
        segment.category !== "Absence" &&
        other.category !== "Work" &&
        other.category !== "Absence"
      ) {
        violations.push(
          `Overlaps illegally with ${other.name} on ${other.date} (${timeStr}).`,
        );
      }
    }
  });

  const activeRules = rules.filter((r) => r.isActive);
  activeRules.forEach((rule) => {
    if (segment.category !== rule.targetCategory) return;

    switch (rule.blueprint) {
      case "MAX_DURATION":
        if (proposedDuration > rule.valueMinutes)
          violations.push(
            `[${rule.name}] Exceeds maximum length of ${rule.valueMinutes / 60} hours.`,
          );
        break;

      case "CONTAINMENT":
        const boundingSeg = agentSegments.find(
          (other) =>
            other.id !== segment.id &&
            other.category === rule.referenceCategory &&
            other.date === segment.date &&
            other.startMin <= newStartMin &&
            other.endMin >= newEndMin,
        );
        if (!boundingSeg)
          violations.push(
            `[${rule.name}] Must be scheduled entirely inside a ${rule.referenceCategory} segment.`,
          );
        break;

      case "MIN_WORK_BEFORE":
        const container = agentSegments.find(
          (other) =>
            other.id !== segment.id &&
            other.category === rule.referenceCategory &&
            other.date === segment.date &&
            other.startMin <= newStartMin &&
            other.endMin >= newEndMin,
        );
        if (container) {
          const workedBefore = newStartMin - container.startMin;
          if (workedBefore < rule.valueMinutes)
            violations.push(
              `[${rule.name}] Must have at least ${rule.valueMinutes} mins of ${rule.referenceCategory} before this segment.`,
            );
        }
        break;

      case "MIN_GAP":
        agentSegments.forEach((other) => {
          if (
            other.id === segment.id ||
            other.isGeneral ||
            other.category !== rule.referenceCategory
          )
            return;

          const otherAbsStart = getAbsoluteMinutes(other.date, other.startMin);
          const otherAbsEnd = getAbsoluteMinutes(other.date, other.endMin);

          const overlaps =
            Math.max(proposedAbsStart, otherAbsStart) <
            Math.min(proposedAbsEnd, otherAbsEnd);
          if (!overlaps) {
            let gap = 0;
            if (proposedAbsEnd <= otherAbsStart)
              gap = otherAbsStart - proposedAbsEnd;
            else if (otherAbsEnd <= proposedAbsStart)
              gap = proposedAbsStart - otherAbsEnd;

            if (gap > 0 && gap < rule.valueMinutes) {
              const timeStr = `${formatTime(other.startMin)} - ${formatTime(other.endMin)}`;
              violations.push(
                `[${rule.name}] Rest period between ${rule.targetCategory} and ${rule.referenceCategory} must be at least ${rule.valueMinutes / 60} hours (Failed against shift ${other.name} on ${other.date} at ${timeStr}).`,
              );
            }
          }
        });
        break;
    }
  });

  return violations;
}
