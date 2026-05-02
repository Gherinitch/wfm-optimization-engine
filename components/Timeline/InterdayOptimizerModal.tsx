"use client";

import React, { useState } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { executeInterdayMove } from "@/utils/hydration";
import { Z_INDEX } from "@/constants/ui";

export const InterdayOptimizerModal = ({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) => {
  const pendingInterdayOptimization = useScheduleStore(
    (state) => state.pendingInterdayOptimization,
  );
  const setPendingInterdayOptimization = useScheduleStore(
    (state) => state.setPendingInterdayOptimization,
  );
  const [rejectedMoves, setRejectedMoves] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  if (!pendingInterdayOptimization) return null;

  const handleToggle = (index: number) => {
    const next = new Set(rejectedMoves);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setRejectedMoves(next);
  };

  const handleConfirm = async () => {
    setIsApplying(true);
    const approvedMoves = pendingInterdayOptimization.moves.filter(
      (_, i) => !rejectedMoves.has(i),
    );

    // Execute moves synchronously since hydration works off SQLite WASM sequentially
    for (const m of approvedMoves) {
      await executeInterdayMove(m.agentId, m.oldDate, m.newDate);
    }

    setPendingInterdayOptimization(null);
    await onComplete(); // Trigger loadData()
    setIsApplying(false);
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4`}
      style={{ zIndex: Z_INDEX.INTRADAY_OPTIMIZER }}
    >
      <div className="bg-surface border border-surfaceBorder rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surfaceBorder bg-surface/50">
          <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Auto Days Off ({pendingInterdayOptimization.startDate} -{" "}
            {pendingInterdayOptimization.endDate})
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Review system proposed day-off reassignments based on coverage
            variance.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 text-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-surfaceBorder">
                <th className="pb-2 font-medium text-gray-400 w-8 text-center text-xs">
                  OK
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs pl-2">
                  Agent ID
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs">
                  Moving From (Overstaffed)
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs">
                  Moving To (Understaffed)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surfaceBorder">
              {pendingInterdayOptimization.moves.map((move, i) => {
                const isRejected = rejectedMoves.has(i);
                return (
                  <tr
                    key={i}
                    className={`group ${isRejected ? "opacity-40" : "hover:bg-surface/50"} transition-opacity`}
                  >
                    <td className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!isRejected}
                        onChange={() => handleToggle(i)}
                        className="rounded border-gray-600 appearance-auto w-3 h-3 bg-transparent checked:bg-indigo-500 accent-indigo-500"
                      />
                    </td>
                    <td className="py-3 font-medium font-mono text-xs pl-2">
                      {move.agentId.substring(0, 6)}...
                    </td>
                    <td className="py-3 text-red-300 line-through text-xs">
                      {move.oldDate}
                    </td>
                    <td className="py-3 text-green-300 font-bold text-xs">
                      {move.newDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pendingInterdayOptimization.moves.length === 0 && (
            <div className="text-center py-8 text-gray-400 font-mono text-sm">
              No moves available or schedule is fully constrained.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surfaceBorder bg-surface/80 flex items-center justify-between">
          <div className="text-sm font-medium">
            <span className="text-gray-400">Total Swaps:</span>{" "}
            <span className="text-white">
              {pendingInterdayOptimization.moves.length - rejectedMoves.size}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingInterdayOptimization(null)}
              disabled={isApplying}
              className="px-4 py-2 hover:bg-surfaceBorder rounded text-sm text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                isApplying ||
                pendingInterdayOptimization.moves.length -
                  rejectedMoves.size ===
                  0
              }
              className="px-6 py-2 bg-indigo-500/20 text-indigo-400 rounded font-medium text-sm hover:bg-indigo-500 hover:text-black border border-indigo-500/30 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.1)] disabled:opacity-50"
            >
              {isApplying ? "Applying..." : "Apply Selection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
