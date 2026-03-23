// components/Timeline/SwapModal.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

export const SwapModal = () => {
  const pendingSwap = useScheduleStore((state) => state.pendingSwap);
  const setPendingSwap = useScheduleStore((state) => state.setPendingSwap);
  const executeShiftTransfer = useScheduleStore(
    (state) => state.executeShiftTransfer,
  );
  const executeShiftSwap = useScheduleStore((state) => state.executeShiftSwap);
  const agents = useScheduleStore((state) => state.agents);

  // FIXED: Call useMemo at the top level BEFORE any early returns!
  const sourceId = pendingSwap?.sourceAgentId;

  const availableAgents = useMemo(() => {
    if (!sourceId) return [];
    return Object.values(agents)
      .filter((a) => a.id !== sourceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, sourceId]);

  // NOW it is safe to return null if the modal is closed
  if (!pendingSwap) return null;

  const sourceAgent = agents[pendingSwap.sourceAgentId];
  const targetAgent = pendingSwap.targetAgentId
    ? agents[pendingSwap.targetAgentId]
    : null;

  if (!sourceAgent) return null;

  const handleTargetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPendingSwap({ ...pendingSwap, targetAgentId: e.target.value });
  };

  const handleTransfer = () => {
    if (targetAgent)
      executeShiftTransfer(sourceAgent.id, targetAgent.id, pendingSwap.date);
  };

  const handleSwap = () => {
    if (targetAgent)
      executeShiftSwap(sourceAgent.id, targetAgent.id, pendingSwap.date);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPendingSwap(null)}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm cursor-pointer"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-surface border border-status-info/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-status-info/20"
        >
          <div className="px-6 py-4 border-b border-surfaceBorder bg-status-info/10">
            <h2 className="font-heading font-bold text-xl text-white">
              Shift Reassignment
            </h2>
            <p className="font-mono text-xs text-gray-400 mt-1">
              Date: {pendingSwap.date}
            </p>
          </div>

          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-background p-5 rounded-xl border border-surfaceBorder">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-status-warning uppercase tracking-widest">
                  Reassigning From
                </span>
                <span className="font-heading font-bold text-lg text-white">
                  {sourceAgent.name}
                </span>
              </div>

              <div className="w-full h-px bg-surfaceBorder/50"></div>

              <div className="flex flex-col gap-2">
                <label className="font-mono text-xs text-status-good uppercase tracking-widest">
                  Select Target Agent
                </label>
                <select
                  value={pendingSwap.targetAgentId || ""}
                  onChange={handleTargetSelect}
                  className="w-full bg-surface border border-surfaceBorder rounded-lg px-3 py-2 text-white font-heading focus:outline-none focus:border-status-info transition-colors"
                >
                  <option value="" disabled>
                    -- Select an Agent --
                  </option>
                  {availableAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {targetAgent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-2 gap-4"
              >
                <button
                  onClick={handleTransfer}
                  className="flex flex-col items-center justify-center gap-3 p-5 bg-surface border border-surfaceBorder hover:border-status-info hover:bg-status-info/10 rounded-xl transition-all group"
                >
                  <div className="p-3 rounded-full bg-surfaceBorder/50 group-hover:bg-status-info/20 group-hover:text-status-info transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                  </div>
                  <span className="font-bold text-white text-sm">
                    1-Way Transfer
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono text-center leading-relaxed">
                    Give shift to {targetAgent.name.split(" ")[0]}.
                  </span>
                </button>

                <button
                  onClick={handleSwap}
                  className="flex flex-col items-center justify-center gap-3 p-5 bg-surface border border-surfaceBorder hover:border-purple-500 hover:bg-purple-500/10 rounded-xl transition-all group"
                >
                  <div className="p-3 rounded-full bg-surfaceBorder/50 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 16 4 4 4-4" />
                      <path d="M7 20V4" />
                      <path d="m21 8-4-4-4 4" />
                      <path d="M17 4v16" />
                    </svg>
                  </div>
                  <span className="font-bold text-white text-sm">
                    2-Way Swap
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono text-center leading-relaxed">
                    Agents securely trade schedules.
                  </span>
                </button>
              </motion.div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-surfaceBorder flex justify-end bg-background/50">
            <button
              onClick={() => setPendingSwap(null)}
              className="px-6 py-2 bg-surface border border-surfaceBorder text-white font-mono text-sm font-bold rounded hover:bg-surfaceBorder transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
