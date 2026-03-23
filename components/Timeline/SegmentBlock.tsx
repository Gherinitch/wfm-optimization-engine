// components/Timeline/SegmentBlock.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useScheduleStore } from "@/store/useScheduleStore";
import { Tooltip } from "@/components/ui/Tooltip";

const formatTime = (mins: number) => {
  const normalized = mins % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export const SegmentBlock = ({ segmentId }: { segmentId: string }) => {
  const segment = useScheduleStore((state) => state.segments[segmentId]);
  const updateSegmentTime = useScheduleStore(
    (state) => state.updateSegmentTime,
  );
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

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  if (!segment || segment.isGeneral) return null;

  const violations = getSegmentViolations(segmentId);
  const hasViolations = violations.length > 0;

  const originalX = (segment.startMin - timelineStartMin) * ppm;
  const width = (segment.endMin - segment.startMin) * ppm;

  if (originalX + width < 0) return null;

  let bgClass = "bg-gray-500 shadow-sm";
  switch (segment.category) {
    case "Work":
      bgClass =
        "bg-status-info hover:bg-blue-600 shadow-md ring-1 ring-status-info/50";
      break;
    case "Break":
      bgClass = "bg-status-risk hover:bg-yellow-500 shadow-sm";
      break;
    case "Lunch":
      bgClass = "bg-status-good hover:bg-green-500 shadow-sm";
      break;
    case "Meeting":
      bgClass = "bg-purple-500 hover:bg-purple-600 shadow-sm";
      break;
    case "Absence":
      bgClass = "bg-status-danger hover:bg-red-600 shadow-sm";
      break;
  }

  if (hasViolations) {
    bgClass +=
      " ring-2 ring-status-danger ring-offset-1 ring-offset-background animate-pulse-slow";
  }

  const hypotheticalStart = segment.startMin + Math.round(dragOffset / ppm);
  const hypotheticalEnd =
    hypotheticalStart + (segment.endMin - segment.startMin);
  const liveViolations = isDragging
    ? checkHypotheticalViolations(segmentId, hypotheticalStart, hypotheticalEnd)
    : [];

  return (
    <motion.div
      // FIXED: justify-start applied to outer wrapper as well
      className={`absolute h-8 top-2 left-0 rounded-md cursor-grab active:cursor-grabbing flex items-center justify-start overflow-hidden transition-colors ${bgClass}`}
      style={{
        width,
        x: originalX + dragOffset,
        zIndex: isDragging ? 99999 : 10000 - segment.rank,
      }}
      drag="x"
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => setIsDragging(true)}
      onDrag={(e, info) => {
        const rawMins = info.offset.x / ppm;
        const snappedMins = Math.round(rawMins / 15) * 15;
        setDragOffset(snappedMins * ppm);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        if (dragOffset !== 0) {
          const minChange = Math.round(dragOffset / ppm);
          const newStart = segment.startMin + minChange;
          const newEnd = segment.endMin + minChange;
          if (liveViolations.length > 0) {
            setPendingOverride({
              segmentId,
              newStart,
              newEnd,
              violations: liveViolations,
            });
          } else {
            updateSegmentTime(segmentId, newStart, newEnd);
          }
        }
        setDragOffset(0);
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
              {formatTime(segment.startMin)} - {formatTime(segment.endMin)}
            </div>
            {violations.length > 0 && (
              <div className="mt-2 pt-2 border-t border-status-danger/30 flex flex-col gap-1">
                {violations.map((v, i) => (
                  <span key={i} className="text-xs text-red-400 font-mono">
                    • {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      >
        <span className="text-[10px] font-heading font-bold text-white/90 truncate px-2 select-none mix-blend-screen drop-shadow-md">
          {segment.name}
        </span>
        {isDragging && liveViolations.length > 0 && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-status-danger rounded-full animate-ping" />
        )}
      </Tooltip>
    </motion.div>
  );
};
