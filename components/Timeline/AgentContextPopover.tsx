// components/Timeline/AgentContextPopover.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { motion, AnimatePresence } from "framer-motion";
import { Segment } from "@/types/wfm";

const formatTime = (mins: number) => {
  const normalized = mins % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export const AgentContextPopover = () => {
  const selectedAgentId = useScheduleStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useScheduleStore(
    (state) => state.setSelectedAgentId,
  );
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);

  if (!selectedAgentId) return null;

  const agent = agents[selectedAgentId];
  if (!agent) return null;

  const allSegments = agent.segments.map((id) => segments[id]).filter(Boolean);

  // FIXED: Sum up anything that is PAID and not a wrapper.
  // This automatically deducts Unpaid Lunches and Unpaid Absences!
  let totalPaidMinutes = 0;
  allSegments.forEach((seg) => {
    if (seg.isPaid && !seg.isGeneral) {
      totalPaidMinutes += seg.endMin - seg.startMin;
    }
  });
  const totalHours = (totalPaidMinutes / 60).toFixed(1);

  const groupedByDate: Record<string, Segment[]> = {};
  allSegments.forEach((seg) => {
    if (!groupedByDate[seg.date]) groupedByDate[seg.date] = [];
    groupedByDate[seg.date].push(seg);
  });

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <AnimatePresence>
      {/* Floating Popover - Fixed to bottom right, no background overlay! */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-8 right-8 z-[999] w-80 bg-surface/95 backdrop-blur-md border border-surfaceBorder rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="p-4 border-b border-surfaceBorder bg-background/50 flex justify-between items-center cursor-default">
          <div className="flex flex-col">
            <h2 className="font-heading font-bold text-lg text-white leading-tight">
              {agent.name}
            </h2>
            <p className="font-mono text-[10px] text-gray-400">
              ID: {agent.id}
            </p>
          </div>
          <button
            onClick={() => setSelectedAgentId(null)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-surfaceBorder rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats Section */}
        <div className="px-4 py-3 border-b border-surfaceBorder bg-status-info/5 flex items-center justify-between">
          <span className="text-xs font-mono text-status-info uppercase tracking-wider">
            Paid Hrs
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-heading font-bold text-xl text-white">
              {totalHours}
            </span>
            <span className="font-mono text-xs text-gray-400">h</span>
          </div>
        </div>

        {/* Schedule Breakdown */}
        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-1.5">
          {sortedDates.map((date) => {
            const daySegments = groupedByDate[date];

            // Calculate today's specific paid time
            const dayPaidMins = daySegments
              .filter((s) => s.isPaid && !s.isGeneral)
              .reduce((acc, s) => acc + (s.endMin - s.startMin), 0);
            const dayPaidHours = (dayPaidMins / 60).toFixed(1);

            const workSegs = daySegments.filter(
              (s) => s.category === "Work" && !s.isGeneral,
            );
            const absences = daySegments.filter(
              (s) => s.category === "Absence",
            );

            let displayNode;

            if (dayPaidMins === 0) {
              // 0 Paid Minutes = They are off, or on an Unpaid full day absence
              if (absences.length > 0) {
                displayNode = (
                  <span className="font-mono text-xs font-bold text-status-danger">
                    {absences[0].name} (Unpaid)
                  </span>
                );
              } else {
                displayNode = (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surfaceBorder/50 text-gray-500">
                    DAY OFF
                  </span>
                );
              }
            } else {
              // They are working, or on a Paid Absence. Let's find their bounds.
              const startMin = Math.min(
                ...daySegments
                  .filter((s) => !s.isGeneral)
                  .map((s) => s.startMin),
              );
              const endMin = Math.max(
                ...daySegments.filter((s) => !s.isGeneral).map((s) => s.endMin),
              );

              displayNode = (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-xs font-bold text-gray-200">
                    {formatTime(startMin)} - {formatTime(endMin)}
                  </span>
                  {absences.length > 0 && (
                    <span className="font-mono text-[9px] text-status-warning/80">
                      includes {absences[0].name}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={date}
                className={`px-3 py-2 rounded-md border ${dayPaidMins === 0 ? "bg-background/30 border-transparent" : "bg-background/80 border-surfaceBorder/50"} flex justify-between items-center`}
              >
                <span className="font-mono text-xs text-gray-400">
                  {date.slice(-5)}
                </span>
                <div className="flex items-center gap-3">
                  {displayNode}
                  {dayPaidMins > 0 && (
                    <span className="font-mono text-[10px] text-status-info w-8 text-right">
                      {dayPaidHours}h
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
