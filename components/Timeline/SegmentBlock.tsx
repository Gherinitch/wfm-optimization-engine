// components/Timeline/SegmentBlock.tsx
"use client";

import { motion } from "framer-motion";
import { useScheduleStore } from "@/store/useScheduleStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { DragState } from "./AgentRow";
import { formatTime } from "@/utils/time";
import { MINS_PER_INTERVAL, MINS_PER_DAY } from "@/constants/wfm";

const ENABLE_TEXT_WRAP = true;

interface SegmentBlockProps {
  segmentId: string;
  dragState: DragState | null;
  setDragState: (state: DragState | null) => void;
}

export const SegmentBlock = ({
  segmentId,
  dragState,
  setDragState,
}: SegmentBlockProps) => {
  const segment = useScheduleStore((state) => state.segments[segmentId]);
  const updateSegmentTime = useScheduleStore(
    (state) => state.updateSegmentTime,
  );
  const shiftAgentDay = useScheduleStore((state) => state.shiftAgentDay);
  const setPendingOverride = useScheduleStore(
    (state) => state.setPendingOverride,
  );
  const getSegmentViolations = useScheduleStore(
    (state) => state.getSegmentViolations,
  );
  const checkHypotheticalViolations = useScheduleStore(
    (state) => state.checkHypotheticalViolations,
  );

  const timelineStartMin = useScheduleStore((state) => state.timelineStartMin);
  const ppm = useScheduleStore((state) => state.pixelsPerMinute);

  if (!segment || segment.isGeneral) return null;

  const isThisDragging = dragState?.segmentId === segmentId;
  const isGroupDragging = dragState?.category === "Work" && !isThisDragging;
  const displayOffsetMins =
    isThisDragging || isGroupDragging ? dragState?.offsetMins || 0 : 0;
  const isVisuallyDragging = isThisDragging || isGroupDragging;

  const violations = getSegmentViolations(segmentId);
  const hasViolations = violations.length > 0;

  const originalX = (segment.startMin - timelineStartMin) * ppm;
  const width = (segment.endMin - segment.startMin) * ppm;
  const duration = segment.endMin - segment.startMin;

  // FIXED: Removed the `originalX + width < 0 -> return null` trap that was unmounting your shifts!

  const hypotheticalStart = segment.startMin + displayOffsetMins;
  const hypotheticalEnd = segment.endMin + displayOffsetMins;

  const liveViolations = isThisDragging
    ? checkHypotheticalViolations(segmentId, hypotheticalStart, hypotheticalEnd)
    : [];

  const isActuallyViolating = hasViolations || liveViolations.length > 0;

  let bgClass =
    "bg-gray-500/70 hover:bg-gray-500/90 backdrop-blur-sm shadow-sm";
  switch (segment.category) {
    case "Work":
      bgClass =
        "bg-blue-500/60 hover:bg-blue-500/80 backdrop-blur-md shadow-sm ring-1 ring-blue-400/30";
      break;
    case "Break":
      bgClass =
        "bg-amber-500/70 hover:bg-amber-500/90 backdrop-blur-md shadow-sm ring-1 ring-amber-400/30";
      break;
    case "Lunch":
      bgClass =
        "bg-emerald-500/70 hover:bg-emerald-500/90 backdrop-blur-md shadow-sm ring-1 ring-emerald-400/30";
      break;
    case "Meeting":
      bgClass =
        "bg-purple-500/70 hover:bg-purple-500/90 backdrop-blur-md shadow-sm ring-1 ring-purple-400/30";
      break;
    case "Absence":
      bgClass =
        "bg-rose-500/70 hover:bg-rose-500/90 backdrop-blur-md shadow-sm ring-1 ring-rose-400/30";
      break;
  }

  if (isActuallyViolating) {
    bgClass +=
      " ring-2 ring-rose-500 ring-offset-1 ring-offset-background animate-pulse-slow";
  }

  return (
    <motion.div
      className={`absolute h-8 top-2 left-0 rounded-md cursor-grab active:cursor-grabbing overflow-hidden transition-colors ${bgClass}`}
      style={{
        width,
        x: originalX + displayOffsetMins * ppm,
        zIndex: isVisuallyDragging ? 99999 : 10000 - segment.rank,
      }}
      onPanStart={() =>
        setDragState({ segmentId, category: segment.category, offsetMins: 0 })
      }
      onPan={(e, info) => {
        const rawMins = info.offset.x / ppm;
        const absoluteProposedStart = segment.startMin + rawMins;

        let snappedStart =
          Math.round(absoluteProposedStart / MINS_PER_INTERVAL) *
          MINS_PER_INTERVAL;

        // FIXED: Clamp strictly to the 24-hour day, regardless of your zoom level!
        if (snappedStart < 0) snappedStart = 0;
        if (snappedStart + duration > MINS_PER_DAY)
          snappedStart = MINS_PER_DAY - duration;

        const offsetMins = snappedStart - segment.startMin;

        if (dragState?.offsetMins !== offsetMins) {
          setDragState({ segmentId, category: segment.category, offsetMins });
        }
      }}
      onPanEnd={(e, info) => {
        const rawMins = info.offset.x / ppm;
        const absoluteProposedStart = segment.startMin + rawMins;

        let snappedStart =
          Math.round(absoluteProposedStart / MINS_PER_INTERVAL) *
          MINS_PER_INTERVAL;

        if (snappedStart < 0) snappedStart = 0;
        if (snappedStart + duration > MINS_PER_DAY)
          snappedStart = MINS_PER_DAY - duration;

        const finalOffset = snappedStart - segment.startMin;

        setDragState(null);

        if (finalOffset !== 0) {
          const finalHypoStart = segment.startMin + finalOffset;
          const finalHypoEnd = segment.endMin + finalOffset;

          const finalViolations = checkHypotheticalViolations(
            segmentId,
            finalHypoStart,
            finalHypoEnd,
          );

          if (finalViolations.length > 0) {
            setPendingOverride({
              segmentId,
              newStart: finalHypoStart,
              newEnd: finalHypoEnd,
              violations: finalViolations,
            });
          } else {
            if (segment.category === "Work") {
              shiftAgentDay(segment.agentId, segment.date, finalOffset);
            } else {
              updateSegmentTime(segmentId, finalHypoStart, finalHypoEnd);
            }
          }
        }
      }}
    >
      <Tooltip
        content={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-surfaceBorder pb-2">
              <span className="font-heading font-bold">{segment.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-surfaceBorder rounded text-gray-400">
                Rank: {segment.rank}
              </span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-gray-400">Time:</span>{" "}
              {formatTime(hypotheticalStart)} - {formatTime(hypotheticalEnd)}
            </div>
            {isActuallyViolating && (
              <div className="mt-2 pt-2 border-t border-status-danger/30 flex flex-col gap-1">
                {(liveViolations.length > 0 ? liveViolations : violations).map(
                  (v, i) => (
                    <span key={i} className="text-xs text-red-400 font-mono">
                      • {v}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        }
      >
        <span
          className={`font-heading font-bold text-white/95 drop-shadow-md select-none w-full h-full flex items-center
            ${
              ENABLE_TEXT_WRAP
                ? "whitespace-normal break-words text-center justify-center text-[9px] leading-[10px] px-0.5"
                : "truncate justify-start text-[10px] px-2 mix-blend-screen"
            }
          `}
        >
          {segment.name}
        </span>

        {isThisDragging && liveViolations.length > 0 && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-status-danger rounded-full animate-ping" />
        )}
      </Tooltip>
    </motion.div>
  );
};
