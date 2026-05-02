"use client";

import React, { useState } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { formatTime } from "@/utils/time";
import { Z_INDEX } from "@/constants/ui";

export const IntradayOptimizerModal = () => {
  const pendingIntradayOptimization = useScheduleStore(
    (state) => state.pendingIntradayOptimization,
  );
  const setPendingIntradayOptimization = useScheduleStore(
    (state) => state.setPendingIntradayOptimization,
  );
  const confirmIntradayOptimization = useScheduleStore(
    (state) => state.confirmIntradayOptimization,
  );
  const segments = useScheduleStore((state) => state.segments);
  const agents = useScheduleStore((state) => state.agents);

  const [rejectedMoves, setRejectedMoves] = useState<Set<string>>(new Set());

  if (!pendingIntradayOptimization) return null;

  const handleToggle = (segmentId: string) => {
    const next = new Set(rejectedMoves);
    if (next.has(segmentId)) next.delete(segmentId);
    else next.add(segmentId);
    setRejectedMoves(next);
  };

  const handleConfirm = () => {
    const approvedMoves = pendingIntradayOptimization.moves.filter(
      (m) => !rejectedMoves.has(m.segmentId),
    );
    confirmIntradayOptimization(approvedMoves);
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4`}
      style={{ zIndex: Z_INDEX.INTRADAY_OPTIMIZER }}
    >
      <div className="bg-surface border border-surfaceBorder rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surfaceBorder bg-surface/50">
          <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-info animate-pulse"></span>
            Auto GST Generated ({pendingIntradayOptimization.date})
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Review the system proposed break movements designed to minimize
            coverage variance.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[60vh] p-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-surfaceBorder">
                <th className="pb-2 font-medium text-gray-400 w-8 text-center text-xs">
                  OK
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs text-left">
                  Agent
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs">
                  Break
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs">
                  Old Time
                </th>
                <th className="pb-2 font-medium text-gray-400 text-xs">
                  New Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surfaceBorder">
              {pendingIntradayOptimization.moves.map((move, i) => {
                const seg = segments[move.segmentId];
                if (!seg) return null;
                const agent = agents[seg.agentId];
                const isRejected = rejectedMoves.has(move.segmentId);

                return (
                  <tr
                    key={i}
                    className={`group ${isRejected ? "opacity-40" : "hover:bg-surface/50"} transition-opacity`}
                  >
                    <td className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!isRejected}
                        onChange={() => handleToggle(move.segmentId)}
                        className="rounded border-gray-600 appearance-auto w-3 h-3 bg-transparent checked:bg-status-success accent-status-success"
                      />
                    </td>
                    <td className="py-3 font-medium">{agent?.name}</td>
                    <td className="py-3 text-xs text-gray-300 font-mono">
                      {seg.name}
                    </td>
                    <td className="py-3 text-red-300 line-through text-xs font-mono">
                      {formatTime(seg.startMin)} - {formatTime(seg.endMin)}
                    </td>
                    <td className="py-3 text-green-300 font-bold text-xs font-mono">
                      {formatTime(move.newStart)} - {formatTime(move.newEnd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-surfaceBorder bg-surface/80 flex items-center justify-between">
          <div className="text-sm font-medium">
            <span className="text-gray-400">Total Moves:</span>{" "}
            <span className="text-white">
              {pendingIntradayOptimization.moves.length - rejectedMoves.size}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingIntradayOptimization(null)}
              className="px-4 py-2 hover:bg-surfaceBorder rounded text-sm text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-status-success/20 text-status-success rounded font-medium text-sm hover:bg-status-success hover:text-black border border-status-success/30 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.1)]"
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
