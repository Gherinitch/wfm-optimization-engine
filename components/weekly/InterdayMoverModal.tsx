// components/weekly/InterdayMoverModal.tsx
"use client";

import { useState, useMemo } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";

interface Props {
  sourceDate: string | null;
  availableDates: string[];
  onClose: () => void;
  onSuccess: () => void; // Used to re-trigger the SQL math in the dashboard
}

export function InterdayMoverModal({
  sourceDate,
  availableDates,
  onClose,
  onSuccess,
}: Props) {
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);
  const moveShiftToDate = useScheduleStore((state) => state.moveShiftToDate);

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");

  // Find all agents who have at least one segment on the sourceDate
  const agentsWorkingSourceDate = useMemo(() => {
    if (!sourceDate) return [];
    return Object.values(agents)
      .filter((agent) =>
        agent.segments.some((segId) => segments[segId]?.date === sourceDate),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, segments, sourceDate]);

  if (!sourceDate) return null;

  const handleMove = () => {
    if (!selectedAgentId || !targetDate) return;
    moveShiftToDate(selectedAgentId, sourceDate, targetDate);
    onSuccess(); // Re-calculate the weekly board!
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-surfaceBorder w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-surfaceBorder flex justify-between items-center bg-surface-light">
          <div>
            <h2 className="text-lg font-bold text-white">Reassign Shift</h2>
            <div className="text-xs text-gray-400 font-mono mt-1">
              From {sourceDate}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Agent Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-widest text-gray-400">
              Select Agent
            </label>
            <select
              className="bg-background border border-surfaceBorder rounded-md p-2 text-sm text-gray-200 focus:outline-none focus:border-status-info"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              <option value="">-- Choose Agent --</option>
              {agentsWorkingSourceDate.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-gray-500">
              {agentsWorkingSourceDate.length} agents working this day
            </div>
          </div>

          {/* Target Date Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-widest text-gray-400">
              Target Date
            </label>
            <select
              className="bg-background border border-surfaceBorder rounded-md p-2 text-sm text-gray-200 focus:outline-none focus:border-status-info"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            >
              <option value="">-- Destination Date --</option>
              {availableDates
                .filter((d) => d !== sourceDate)
                .map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-surfaceBorder bg-background flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selectedAgentId || !targetDate}
            className="px-4 py-2 bg-status-info hover:bg-status-info/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold rounded shadow-sm transition-colors text-sm"
          >
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
}
