// components/Timeline/AgentContextModal.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { motion, AnimatePresence } from "framer-motion";
import { Segment } from "@/types/wfm";
import { formatTime } from "@/utils/time";
import { Z_INDEX } from "@/constants/ui";
import { MINS_PER_HOUR } from "@/constants/wfm";

const calculatePaidMinutes = (daySegments: Segment[]) => {
  if (!daySegments || daySegments.length === 0) return 0;
  const minuteMap = new Array(2880).fill(false);

  daySegments.forEach((seg) => {
    if (seg.isPaid && !seg.isGeneral) {
      for (let m = seg.startMin; m < seg.endMin; m++) minuteMap[m] = true;
    }
  });

  daySegments.forEach((seg) => {
    if (!seg.isPaid && !seg.isGeneral) {
      for (let m = seg.startMin; m < seg.endMin; m++) minuteMap[m] = false;
    }
  });

  return minuteMap.filter(Boolean).length;
};

export const AgentContextModal = () => {
  const selectedAgentId = useScheduleStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useScheduleStore(
    (state) => state.setSelectedAgentId,
  );
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);

  if (!selectedAgentId) return null;

  const agent = agents[selectedAgentId];
  if (!agent) return null;

  // 1. Build a Master List of ALL dates that exist in the loaded CSV data
  const allUniqueDates = Array.from(
    new Set(Object.values(segments).map((seg) => seg.date)),
  ).sort();

  // 2. Group this specific agent's segments by date
  const allSegments = agent.segments.map((id) => segments[id]).filter(Boolean);
  const groupedByDate: Record<string, Segment[]> = {};
  allSegments.forEach((seg) => {
    if (!groupedByDate[seg.date]) groupedByDate[seg.date] = [];
    groupedByDate[seg.date].push(seg);
  });

  // 3. Calculate Total Weekly Hours
  let totalWeeklyMins = 0;
  allUniqueDates.forEach((date) => {
    totalWeeklyMins += calculatePaidMinutes(groupedByDate[date] || []);
  });
  const totalWeeklyHours = (totalWeeklyMins / MINS_PER_HOUR).toFixed(1);

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 flex items-center justify-center p-4`}
        style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedAgentId(null)}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm cursor-pointer"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10"
        >
          <div className="px-6 py-4 border-b border-surfaceBorder bg-background/50 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading font-bold text-xl text-white leading-none">
                {agent.name}
              </h2>
              <p className="font-mono text-xs text-gray-500">
                Agent ID: {agent.id}
              </p>
            </div>
            <button
              onClick={() => setSelectedAgentId(null)}
              className="p-2 text-gray-400 hover:text-white hover:bg-surfaceBorder rounded-full transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 border-b border-surfaceBorder bg-status-info/5 flex items-center justify-between">
            <span className="text-sm font-mono text-status-info uppercase tracking-wider font-semibold">
              Total Paid Time
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-heading font-bold text-3xl text-white">
                {totalWeeklyHours}
              </span>
              <span className="font-mono text-sm text-gray-400 font-bold">
                hrs
              </span>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-4 custom-scrollbar flex flex-col gap-2">
            {allUniqueDates.map((date) => {
              // Now we pull from the Master List. If the agent isn't scheduled at all, daySegments = []
              const daySegments = groupedByDate[date] || [];
              const dayPaidMins = calculatePaidMinutes(daySegments);
              const dayPaidHours = (dayPaidMins / MINS_PER_HOUR).toFixed(1);
              const absences = daySegments.filter(
                (s) => s.category === "Absence",
              );

              let displayNode;

              if (dayPaidMins === 0) {
                if (absences.length > 0) {
                  displayNode = (
                    <span className="font-mono text-sm font-bold text-status-danger">
                      {absences[0].name}
                    </span>
                  );
                } else {
                  // If they have 0 paid minutes and NO logged absence, it is a clean day off.
                  displayNode = (
                    <span className="font-mono text-xs px-2 py-1 rounded bg-surfaceBorder/50 text-gray-500 font-bold tracking-widest">
                      OFF DAY
                    </span>
                  );
                }
              } else {
                const actionableSegs = daySegments.filter(
                  (s) => !s.isGeneral && s.category !== "Absence",
                );

                let startStr = "--:--";
                let endStr = "--:--";
                if (actionableSegs.length > 0) {
                  const startMin = Math.min(
                    ...actionableSegs.map((s) => s.startMin),
                  );
                  const endMin = Math.max(
                    ...actionableSegs.map((s) => s.endMin),
                  );
                  startStr = formatTime(startMin);
                  endStr = formatTime(endMin);
                }

                displayNode = (
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-bold text-gray-200">
                      {startStr} - {endStr}
                    </span>
                    {absences.length > 0 && (
                      <span className="font-mono text-[10px] text-status-warning/80 mt-0.5">
                        Includes: {absences[0].name}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={date}
                  className={`px-4 py-3 rounded-xl border ${dayPaidMins === 0 ? "bg-background/40 border-surfaceBorder/30" : "bg-surface/80 border-surfaceBorder"} flex justify-between items-center`}
                >
                  <span className="font-mono text-sm text-gray-400">
                    {date}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="text-right">{displayNode}</div>
                    <div className="w-12 text-right">
                      {dayPaidMins > 0 && (
                        <span className="font-mono text-sm font-bold text-status-info">
                          {dayPaidHours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
