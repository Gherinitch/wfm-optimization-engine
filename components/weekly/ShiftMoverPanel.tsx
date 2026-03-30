// components/weekly/ShiftMoverPanel.tsx
"use client";

import { useEffect, useState } from "react";
import {
  fetchAgentsForReassignment,
  executeInterdayMove,
} from "@/utils/hydration";

interface Props {
  sourceDate: string | null;
  availableDates: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
};

export function ShiftMoverPanel({
  sourceDate,
  availableDates,
  onClose,
  onSuccess,
}: Props) {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetDates, setTargetDates] = useState<Record<string, string>>({});
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (!sourceDate || availableDates.length === 0) return;
    const load = async () => {
      setIsLoading(true);
      const weekStart = availableDates[0];
      const weekEnd = availableDates[availableDates.length - 1];
      const data = await fetchAgentsForReassignment(
        sourceDate,
        weekStart,
        weekEnd,
      );
      setAgents(data);
      setIsLoading(false);
    };
    load();
  }, [sourceDate, availableDates]);

  if (!sourceDate) return null;

  const handleMove = async (agentId: string) => {
    const targetDate = targetDates[agentId];
    if (!targetDate) return;
    setIsMoving(true);
    await executeInterdayMove(agentId, sourceDate, targetDate);
    onSuccess();
    onClose();
    setIsMoving(false);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[100000] bg-background/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] z-[100001] bg-surface border-l border-surfaceBorder shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surfaceBorder flex justify-between items-start bg-surface-light">
          <div>
            <h2 className="text-xl font-heading font-bold text-white">
              Reassign Shifts
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Select an agent working on{" "}
              <span className="text-status-info font-mono">{sourceDate}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="text-center text-status-info font-mono mt-10">
              Loading agent schedules...
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center text-gray-500 font-mono mt-10">
              No agents scheduled for this day.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-background border border-surfaceBorder rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="font-bold text-white">{agent.name}</div>

                  {/* Micro-Schedule Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {availableDates.map((date) => {
                      const isWorking = !!agent.schedule[date];
                      const isSource = date === sourceDate;
                      return (
                        <div
                          key={date}
                          className={`flex flex-col items-center justify-center p-1.5 rounded text-[10px] font-mono text-center
                          ${
                            isSource
                              ? "bg-status-info/20 border border-status-info/50 text-status-info"
                              : isWorking
                                ? "bg-surface-light text-gray-300"
                                : "bg-surface border border-surfaceBorder/30 text-gray-600"
                          }`}
                        >
                          <span className="font-bold mb-0.5">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "narrow",
                              timeZone: "UTC",
                            })}
                          </span>
                          {isWorking ? (
                            <div className="flex flex-col leading-tight">
                              <span>
                                {formatTime(agent.schedule[date].start).replace(
                                  ":00",
                                  "",
                                )}
                              </span>
                              <span className="opacity-50">to</span>
                              <span>
                                {formatTime(agent.schedule[date].end).replace(
                                  ":00",
                                  "",
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="mt-1">OFF</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Bar */}
                  <div className="flex gap-2 mt-2 pt-3 border-t border-surfaceBorder/50">
                    <select
                      className="flex-1 bg-surface border border-surfaceBorder rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-status-info"
                      value={targetDates[agent.id] || ""}
                      onChange={(e) =>
                        setTargetDates({
                          ...targetDates,
                          [agent.id]: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Move to Date --</option>
                      {availableDates
                        .filter((d) => d !== sourceDate && !agent.schedule[d])
                        .map((date) => (
                          <option key={date} value={date}>
                            {date} (OFF)
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => handleMove(agent.id)}
                      disabled={!targetDates[agent.id] || isMoving}
                      className="px-4 py-1.5 bg-status-info hover:bg-status-info/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold rounded shadow-sm text-xs transition-colors"
                    >
                      Move
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
