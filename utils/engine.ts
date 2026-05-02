// utils/engine.ts

import {
  EditRecord,
  Segment,
  Agent,
  CustomRule,
  Requirement,
} from "@/types/wfm";
import { logger } from "@/utils/logger";
import { formatTime } from "@/utils/time";
import { MINS_PER_INTERVAL } from "@/constants/wfm";

const dateCache = new Map<string, number>();

export function getAbsoluteMinutes(
  dateStr: string,
  minutesFromMidnight: number,
): number {
  if (!dateStr || typeof dateStr !== "string") {
    logger.error("Invalid date string provided to getAbsoluteMinutes", {
      dateStr,
    });
    return minutesFromMidnight; // Fallback to just minutes from midnight
  }

  if (!dateCache.has(dateStr)) {
    let d: Date;
    let parsed = false;

    // Try standard ISO format first
    d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      parsed = true;
    } else {
      // Try dd-mm-yyyy format (common in CSV imports)
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3 && parts.every((part) => part.length >= 1)) {
        // Determine year position (at end if 4 digits, otherwise at start)
        const year = parts[2].length === 4 ? parts[2] : parts[0];
        const month = parts[2].length === 4 ? parts[1] : parts[1];
        const day = parts[2].length === 4 ? parts[0] : parts[2];

        d = new Date(`${year}-${month}-${day}T00:00:00Z`);
        if (!isNaN(d.getTime())) {
          parsed = true;
        }
      }
    }

    if (!parsed) {
      logger.error("Failed to parse date string", { dateStr });
      return minutesFromMidnight; // Fallback to just minutes from midnight
    }

    // Validate date is in a reasonable range (year 2000-2100)
    const year = d.getFullYear();
    if (year < 2000 || year > 2100) {
      logger.warn("Parsed date is outside expected range", { dateStr, year });
    }

    dateCache.set(dateStr, Math.floor(d.getTime() / 60000));
  }

  const cachedMinutes = dateCache.get(dateStr);
  if (cachedMinutes === undefined) {
    logger.error("Date cache lookup failed", { dateStr });
    return minutesFromMidnight;
  }

  return cachedMinutes + minutesFromMidnight;
}

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
  const newEdits = [...edits];

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
        id: `edit_${Date.now()}_${segmentId}_${Math.random().toString(36).substring(2, 7)}`,
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
  if (!agent) return [];
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

  // --- Default Ordering Rules ---
  const isFirstBreak = (name: string) => {
    const n = name.toLowerCase();
    return n.includes("break") && (n.includes("1st") || n.includes("first"));
  };
  const isSecondBreak = (name: string) => {
    const n = name.toLowerCase();
    return n.includes("break") && (n.includes("2nd") || n.includes("second"));
  };
  const isLunchStr = (name: string) => name.toLowerCase().includes("lunch");

  const firstBreaks = agentSegments.filter(
    (s) =>
      s.id !== segment.id && isFirstBreak(s.name) && s.date === segment.date,
  );
  const secondBreaks = agentSegments.filter(
    (s) =>
      s.id !== segment.id && isSecondBreak(s.name) && s.date === segment.date,
  );
  const lunches = agentSegments.filter(
    (s) => s.id !== segment.id && isLunchStr(s.name) && s.date === segment.date,
  );

  if (isFirstBreak(segment.name)) {
    secondBreaks.forEach((sb) => {
      if (proposedAbsEnd > getAbsoluteMinutes(sb.date, sb.startMin)) {
        violations.push("1st Break must be scheduled before 2nd Break.");
      }
    });
    lunches.forEach((lu) => {
      if (proposedAbsEnd > getAbsoluteMinutes(lu.date, lu.startMin)) {
        violations.push("1st Break must be scheduled before Lunch.");
      }
    });
  }

  if (isSecondBreak(segment.name)) {
    firstBreaks.forEach((fb) => {
      if (proposedAbsStart < getAbsoluteMinutes(fb.date, fb.endMin)) {
        violations.push("2nd Break must be scheduled after 1st Break.");
      }
    });
    lunches.forEach((lu) => {
      if (proposedAbsStart < getAbsoluteMinutes(lu.date, lu.endMin)) {
        violations.push("2nd Break must be scheduled after Lunch.");
      }
    });
  }

  if (isLunchStr(segment.name)) {
    firstBreaks.forEach((fb) => {
      if (proposedAbsStart < getAbsoluteMinutes(fb.date, fb.endMin)) {
        violations.push("Lunch must be scheduled after 1st Break.");
      }
    });
    secondBreaks.forEach((sb) => {
      if (proposedAbsEnd > getAbsoluteMinutes(sb.date, sb.startMin)) {
        violations.push("Lunch must be scheduled before 2nd Break.");
      }
    });
  }
  // ------------------------------

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

            if (gap >= 0 && gap < rule.valueMinutes) {
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

export async function runIntradayOptimization(
  date: string,
  segments: Record<string, Segment>,
  agents: Record<string, Agent>,
  requirements: Record<string, Requirement>,
  rules: CustomRule[],
  onProgress?: (progress: number) => void,
): Promise<{ segmentId: string; newStart: number; newEnd: number }[]> {
  const simSegments = { ...segments };

  const getVariance = () => {
    let penalty = 0;
    for (let slot = 480; slot < 1200; slot += MINS_PER_INTERVAL) {
      const reqId = `req_${date}_${slot}`;
      const required = requirements[reqId]?.req || 0;

      let scheduled = 0;
      Object.values(simSegments).forEach((seg) => {
        if (seg.date !== date || seg.isGeneral) return;
        if (
          seg.category === "Work" &&
          seg.startMin <= slot &&
          seg.endMin > slot
        ) {
          const hasBreak = Object.values(simSegments).some(
            (b) =>
              b.agentId === seg.agentId &&
              b.date === date &&
              b.category !== "Work" &&
              b.category !== "Absence" &&
              b.startMin <= slot &&
              b.endMin > slot,
          );
          if (!hasBreak) scheduled++;
        }
      });
      const net = scheduled - required;
      if (required > 0) {
        const coverage = scheduled / required;
        if (coverage < 0.7) {
          const deficit = 0.7 - coverage;
          // Apply a massive weight for being under the 70% target SLA threshold
          penalty += 1000000 + deficit * 100000 + net * net;
        } else {
          penalty += net * net;
        }
      } else {
        penalty += net * net;
      }
    }
    return penalty;
  };

  const breakIdsToMove = Object.values(simSegments)
    .filter(
      (seg) =>
        seg.date === date &&
        !seg.isGeneral &&
        seg.category !== "Work" &&
        seg.category !== "Absence",
    )
    .map((seg) => seg.id);

  for (let iteration = 0; iteration < 20; iteration++) {
    if (onProgress) onProgress(((iteration + 1) / 20) * 100);
    // Yield to the event loop so the browser doesn't freeze
    await new Promise((resolve) => setTimeout(resolve, 0));

    let bestMove: {
      segmentId: string;
      newStart: number;
      newEnd: number;
      varianceDelta: number;
    } | null = null;
    const currentVariance = getVariance();

    for (const segId of breakIdsToMove) {
      const seg = simSegments[segId];
      const parentShift = Object.values(simSegments).find(
        (s) =>
          s.agentId === seg.agentId && s.date === date && s.category === "Work",
      );
      if (!parentShift) continue;

      const duration = seg.endMin - seg.startMin;

      for (
        let start = parentShift.startMin;
        start <= parentShift.endMin - duration;
        start += MINS_PER_INTERVAL
      ) {
        if (start === seg.startMin) continue;

        const violations = runConstraintEngine(
          seg.id,
          start,
          start + duration,
          simSegments,
          agents,
          rules,
        );
        if (violations.length > 0) continue;

        const originalStart = simSegments[seg.id].startMin;
        const originalEnd = simSegments[seg.id].endMin;
        simSegments[seg.id] = {
          ...simSegments[seg.id],
          startMin: start,
          endMin: start + duration,
        } as Segment;

        const newVariance = getVariance();
        simSegments[seg.id] = {
          ...simSegments[seg.id],
          startMin: originalStart,
          endMin: originalEnd,
        } as Segment;

        const varianceDelta = currentVariance - newVariance;
        if (
          varianceDelta > 0 &&
          (!bestMove || varianceDelta > bestMove.varianceDelta)
        ) {
          bestMove = {
            segmentId: seg.id,
            newStart: start,
            newEnd: start + duration,
            varianceDelta,
          };
        }
      }
    }

    if (!bestMove) break;

    const segToUpdate = simSegments[bestMove.segmentId];
    simSegments[bestMove.segmentId] = {
      ...segToUpdate,
      startMin: bestMove.newStart,
      endMin: bestMove.newEnd,
    } as Segment;
  }

  const finalMoves = [];
  for (const segId of breakIdsToMove) {
    const original = segments[segId];
    const simulated = simSegments[segId];
    if (
      original.startMin !== simulated.startMin ||
      original.endMin !== simulated.endMin
    ) {
      finalMoves.push({
        segmentId: segId,
        newStart: simulated.startMin,
        newEnd: simulated.endMin,
      });
    }
  }

  return finalMoves;
}
