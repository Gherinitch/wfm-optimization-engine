// components/Timeline/SwapModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";

const formatTime = (mins: number) => {
  const normalized = mins % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// Clean UI component for displaying the time range
const ShiftBadge = ({
  bounds,
}: {
  bounds: { startMin: number; endMin: number } | null;
}) => {
  if (!bounds)
    return (
      <span className="text-gray-500 italic text-xs bg-surfaceBorder/30 px-2 py-1 rounded">
        Day Off
      </span>
    );
  return (
    <span className="font-mono text-[11px] text-gray-200 bg-surfaceBorder/30 px-2 py-1 rounded border border-surfaceBorder shadow-sm">
      {formatTime(bounds.startMin)} - {formatTime(bounds.endMin)}
    </span>
  );
};

export const SwapModal = () => {
  const pendingSwap = useScheduleStore((state) => state.pendingSwap);
  const setPendingSwap = useScheduleStore((state) => state.setPendingSwap);
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);
  const executeShiftSwap = useScheduleStore((state) => state.executeShiftSwap);
  const executeThreeWaySwap = useScheduleStore(
    (state) => state.executeThreeWaySwap,
  );

  const [swapType, setSwapType] = useState<"2-way" | "3-way">("2-way");
  const [targetB, setTargetB] = useState<string>("");
  const [targetC, setTargetC] = useState<string>("");

  // Reset local state when modal closes
  useEffect(() => {
    if (!pendingSwap) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetB("");
      setTargetC("");
      setSwapType("2-way");
    }
  }, [pendingSwap]);

  if (!pendingSwap) return null;

  const sourceAgent = agents[pendingSwap.sourceAgentId];
  if (!sourceAgent) return null;

  // Prevent users from selecting the source agent as a target
  const availableTargets = Object.values(agents).filter(
    (a) => a.id !== sourceAgent.id,
  );

  const isValid =
    swapType === "2-way"
      ? !!targetB
      : !!targetB && !!targetC && targetB !== targetC;

  const handleConfirm = () => {
    if (!isValid) return;
    if (swapType === "2-way") {
      executeShiftSwap(sourceAgent.id, targetB, pendingSwap.date);
    } else {
      executeThreeWaySwap(sourceAgent.id, targetB, targetC, pendingSwap.date);
    }
  };

  // Helper to extract the absolute start and end time of an agent's day
  const getShiftBounds = (agentId: string) => {
    if (!agentId) return null;
    const agent = agents[agentId];
    if (!agent) return null;

    // Filter out invisible wrappers and absences to get the true working footprint
    const dailySegs = agent.segments
      .map((id) => segments[id])
      .filter(
        (seg) =>
          seg &&
          seg.date === pendingSwap.date &&
          !seg.isGeneral &&
          seg.category !== "Absence",
      );

    if (dailySegs.length === 0) return null;

    return {
      startMin: Math.min(...dailySegs.map((s) => s.startMin)),
      endMin: Math.max(...dailySegs.map((s) => s.endMin)),
    };
  };

  const sourceBounds = getShiftBounds(sourceAgent.id);
  const targetBBounds = getShiftBounds(targetB);
  const targetCBounds = getShiftBounds(targetC);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-surfaceBorder rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surfaceBorder flex justify-between items-center bg-background/50">
          <h2 className="font-heading font-bold text-lg text-white">
            Execute Shift Swap
          </h2>
          <button
            onClick={() => setPendingSwap(null)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Type Selection */}
          <div className="flex bg-background rounded-lg p-1 border border-surfaceBorder">
            <button
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${swapType === "2-way" ? "bg-status-info text-white shadow" : "text-gray-400 hover:text-gray-200"}`}
              onClick={() => setSwapType("2-way")}
            >
              2-Way Swap
            </button>
            <button
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${swapType === "3-way" ? "bg-status-info text-white shadow" : "text-gray-400 hover:text-gray-200"}`}
              onClick={() => setSwapType("3-way")}
            >
              3-Way Swap
            </button>
          </div>

          {/* Target Selection UI */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                <span>Source Agent</span>
                <span>Current Shift</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background border border-surfaceBorder rounded text-sm text-gray-300 cursor-not-allowed flex-1 truncate">
                  {sourceAgent.name}
                </div>
                <div className="shrink-0 w-32 flex justify-end">
                  <ShiftBadge bounds={sourceBounds} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                <span>Target Agent B</span>
                <span>Current Shift</span>
              </label>
              <div className="flex items-center gap-3">
                <select
                  className="p-2 bg-surface border border-surfaceBorder rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-status-info flex-1 truncate cursor-pointer"
                  value={targetB}
                  onChange={(e) => setTargetB(e.target.value)}
                >
                  <option value="">Select Agent B...</option>
                  {availableTargets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <div className="shrink-0 w-32 flex justify-end">
                  <ShiftBadge bounds={targetBBounds} />
                </div>
              </div>
            </div>

            {swapType === "3-way" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                  <span>Target Agent C</span>
                  <span>Current Shift</span>
                </label>
                <div className="flex items-center gap-3">
                  <select
                    className="p-2 bg-surface border border-surfaceBorder rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-status-info flex-1 truncate cursor-pointer"
                    value={targetC}
                    onChange={(e) => setTargetC(e.target.value)}
                  >
                    <option value="">Select Agent C...</option>
                    {availableTargets.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={a.id === targetB}
                      >
                        {a.name}
                      </option>
                    ))}
                  </select>{" "}
                  {/* FIXED TYPO HERE */}
                  <div className="shrink-0 w-32 flex justify-end">
                    <ShiftBadge bounds={targetCBounds} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC RECAP INFO - Appears instantly when valid targets are selected */}
          {isValid && (
            <div className="mt-2 p-4 bg-background border border-status-info/30 rounded-lg flex flex-col gap-3 shadow-inner">
              <h3 className="text-[10px] font-bold text-status-info uppercase tracking-wider mb-1">
                New Assignments Preview
              </h3>

              <div className="flex justify-between items-center text-sm border-b border-surfaceBorder/50 pb-2">
                <span className="text-white truncate pr-2">
                  {sourceAgent.name}
                </span>
                <span className="text-gray-500 text-xs italic px-2 shrink-0">
                  receives
                </span>
                <div className="shrink-0 w-32 flex justify-end">
                  <ShiftBadge
                    bounds={
                      swapType === "2-way" ? targetBBounds : targetCBounds
                    }
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-surfaceBorder/50 pb-2">
                <span className="text-status-info font-bold truncate pr-2">
                  {agents[targetB]?.name}
                </span>
                <span className="text-gray-500 text-xs italic px-2 shrink-0">
                  receives
                </span>
                <div className="shrink-0 w-32 flex justify-end">
                  <ShiftBadge bounds={sourceBounds} />
                </div>
              </div>

              {swapType === "3-way" && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-purple-400 font-bold truncate pr-2">
                    {agents[targetC]?.name}
                  </span>
                  <span className="text-gray-500 text-xs italic px-2 shrink-0">
                    receives
                  </span>
                  <div className="shrink-0 w-32 flex justify-end">
                    <ShiftBadge bounds={targetBBounds} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surfaceBorder bg-background/50 flex justify-end gap-3">
          <button
            onClick={() => setPendingSwap(null)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-5 py-2 bg-status-good hover:bg-green-600 text-white text-sm font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-status-good/20 disabled:shadow-none"
          >
            Confirm Execution
          </button>
        </div>
      </div>
    </div>
  );
};
