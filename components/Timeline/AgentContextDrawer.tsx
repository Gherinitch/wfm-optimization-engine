// components/Timeline/AgentContextDrawer.tsx
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

export const AgentContextDrawer = () => {
  const selectedAgentId = useScheduleStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useScheduleStore(
    (state) => state.setSelectedAgentId,
  );
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);

  if (!selectedAgentId) return null;

  const agent = agents[selectedAgentId];
  if (!agent) return null;

  // 1. Get all segments across ALL loaded dates for this agent
  const allSegments = agent.segments.map((id) => segments[id]).filter(Boolean);

  // 2. Calculate Total Scheduled Productive Time
  let totalProductiveMinutes = 0;
  allSegments.forEach((seg) => {
    if (seg.category === "Work" && !seg.isGeneral) {
      totalProductiveMinutes += seg.endMin - seg.startMin;
    }
  });
  const totalHours = (totalProductiveMinutes / 60).toFixed(1);

  // 3. Group by Date to build the mini-calendar
  const groupedByDate: Record<string, Segment[]> = {};
  allSegments.forEach((seg) => {
    if (!groupedByDate[seg.date]) groupedByDate[seg.date] = [];
    groupedByDate[seg.date].push(seg);
  });

  // Sort the dates chronologically
  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedAgentId(null)}
          className="absolute inset-0 bg-background/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-96 max-w-full bg-surface border-l border-surfaceBorder h-full flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-surfaceBorder bg-background/50 flex justify-between items-start">
            <div>
              <h2 className="font-heading font-bold text-2xl text-white">
                {agent.name}
              </h2>
              <p className="font-mono text-sm text-gray-400">ID: {agent.id}</p>
            </div>
            <button
              onClick={() => setSelectedAgentId(null)}
              className="p-2 text-gray-400 hover:text-white hover:bg-surfaceBorder rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Stats Section */}
          <div className="p-6 border-b border-surfaceBorder bg-status-info/5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-status-info uppercase tracking-wider">
                Scheduled Productive Time
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-heading font-bold text-3xl text-white">
                  {totalHours}
                </span>
                <span className="font-mono text-gray-400">hours</span>
              </div>
            </div>
          </div>

          {/* Schedule Breakdown */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4 border-b border-surfaceBorder pb-2">
              Multi-Day Breakdown
            </h3>

            <div className="flex flex-col gap-3">
              {sortedDates.map((date) => {
                const daySegments = groupedByDate[date];

                // Find primary shift bounds
                const workSegs = daySegments.filter(
                  (s) => s.category === "Work" && !s.isGeneral,
                );
                const isOff = workSegs.length === 0;

                let startStr = "--:--";
                let endStr = "--:--";

                if (!isOff) {
                  const startMin = Math.min(...workSegs.map((s) => s.startMin));
                  const endMin = Math.max(...workSegs.map((s) => s.endMin));
                  startStr = formatTime(startMin);
                  endStr = formatTime(endMin);
                }

                // Look for absences
                const absences = daySegments.filter(
                  (s) => s.category === "Absence",
                );
                const hasAbsence = absences.length > 0;

                return (
                  <div
                    key={date}
                    className={`p-3 rounded border ${isOff ? "bg-background/50 border-surfaceBorder/30" : "bg-surface border-surfaceBorder"} flex justify-between items-center`}
                  >
                    <span className="font-mono text-sm text-gray-300">
                      {date}
                    </span>

                    {isOff ? (
                      <span className="font-mono text-xs px-2 py-1 rounded bg-surfaceBorder/50 text-gray-500">
                        DAY OFF
                      </span>
                    ) : hasAbsence ? (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm font-bold text-status-danger">
                          Absence Logged
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">
                          {absences[0].name}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-sm font-bold text-status-good">
                        {startStr} - {endStr}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
