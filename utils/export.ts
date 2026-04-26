// utils/export.ts
import { Segment } from "@/types/wfm";

/**
 * Generates a standard WFM formatted CSV payload string representing the exact
 * delta differences between original segments and their new adjusted states.
 * 
 * Rules:
 * - 21,<AgentID>,<Segment>,<Date>,,,, (Delete original)
 * - 00,<AgentID>,<Segment>,<Date>,<StartDate>,<StartTime>,<Duration>, (Create new)
 */
export function generateDeltaExport(
  originalSegments: Record<string, Segment>,
  currentSegments: Record<string, Segment>
): string {
  const lines: string[] = [];
  
  const formatTime = (mins: number) => {
    let normalized = mins;
    if (normalized < 0) normalized += 1440;
    
    // Support rolling over to next day organically
    const actualMins = normalized % 1440;
    const h = Math.floor(actualMins / 60);
    const m = actualMins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const getDuration = (start: number, end: number) => {
    let dur = end - start;
    if (dur < 0) dur += 1440;
    return formatTime(dur);
  };

  const getStartDate = (baseDate: string, startMin: number) => {
      // If startMin > 1440 we must roll date
      if (startMin >= 1440) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + 1);
          return d.toISOString().split("T")[0];
      }
      return baseDate;
  };

  const keys = new Set([...Object.keys(originalSegments), ...Object.keys(currentSegments)]);

  keys.forEach((id) => {
    const orig = originalSegments[id];
    const curr = currentSegments[id];

    if (orig && !curr) {
      // It was completely deleted
      lines.push(`21,${orig.agentId},${orig.name},${orig.date},,,,`);
    } else if (!orig && curr) {
      // It's a brand new segment created from scratch
      const actualStartDate = getStartDate(curr.date, curr.startMin);
      const startTimeStr = formatTime(curr.startMin);
      const durationStr = getDuration(curr.startMin, curr.endMin);
      lines.push(`00,${curr.agentId},${curr.name},${curr.date},${actualStartDate},${startTimeStr},${durationStr},`);
    } else if (orig && curr) {
      // Check if it was modified in any meaningful way
      if (
        orig.startMin !== curr.startMin ||
        orig.endMin !== curr.endMin ||
        orig.date !== curr.date ||
        orig.agentId !== curr.agentId ||
        orig.name !== curr.name
      ) {
        // Issue 21 for the old position
        lines.push(`21,${orig.agentId},${orig.name},${orig.date},,,,`);
        
        // Issue 00 for the new position
        const actualStartDate = getStartDate(curr.date, curr.startMin);
        const startTimeStr = formatTime(curr.startMin);
        const durationStr = getDuration(curr.startMin, curr.endMin);
        lines.push(`00,${curr.agentId},${curr.name},${curr.date},${actualStartDate},${startTimeStr},${durationStr},`);
      }
    }
  });

  return lines.join("\n");
}
