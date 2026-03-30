// app/weekly/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDateRangeMetrics,
  fetchFullWeeklyGrid,
  executeInterdayMove,
} from "@/utils/hydration";
import { dbClient } from "@/utils/dbClient";
import Link from "next/link";

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
};

export default function WeeklyBalancing() {
  const [metrics, setMetrics] = useState<any>(null);
  const [grid, setGrid] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isEmpty, setIsEmpty] = useState(false);

  // Interaction State: tracks which shift the user is currently trying to move
  const [moveState, setMoveState] = useState<{
    agentId: string;
    sourceDate: string;
  } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const loadData = useCallback(async () => {
    await dbClient.init();
    const bounds = await dbClient.query(
      `SELECT MIN(date) as minDate, MAX(date) as maxDate FROM requirements`,
    );
    if (!bounds[0] || !bounds[0].minDate) {
      setIsEmpty(true);
      return;
    }

    const dynamicStart = bounds[0].minDate;
    const dynamicEnd = bounds[0].maxDate;
    setDateRange({ start: dynamicStart, end: dynamicEnd });

    // Fetch both the math and the grid layout in parallel
    const [metricsData, gridData] = await Promise.all([
      fetchDateRangeMetrics(dynamicStart, dynamicEnd),
      fetchFullWeeklyGrid(dynamicStart, dynamicEnd),
    ]);

    setMetrics(metricsData);
    setGrid(gridData);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // The Magic Click Handler
  const handleCellClick = async (
    agentId: string,
    date: string,
    hasShift: boolean,
  ) => {
    if (isMoving) return;

    if (hasShift) {
      // If clicking a shift, select it (or deselect if already selected)
      if (moveState?.agentId === agentId && moveState?.sourceDate === date) {
        setMoveState(null);
      } else {
        setMoveState({ agentId, sourceDate: date });
      }
    } else {
      // If clicking an empty cell, and we have a shift selected for this agent -> MOVE IT!
      if (moveState?.agentId === agentId) {
        setIsMoving(true);
        await executeInterdayMove(agentId, moveState.sourceDate, date);
        setMoveState(null);
        await loadData();
        setIsMoving(false);
      }
    }
  };

  // Keyboard shortcut to cancel move
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoveState(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (isEmpty)
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center font-mono text-status-danger gap-4">
        <div>⚠️ No data found in the database.</div>
        <Link
          href="/"
          className="px-4 py-2 bg-surface border border-surfaceBorder rounded text-white hover:bg-surfaceBorder transition-colors"
        >
          Go to Intraday to load data
        </Link>
      </div>
    );

  if (!metrics || grid.length === 0)
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center font-mono text-status-info gap-4">
        <div className="w-6 h-6 border-2 border-status-info border-t-transparent rounded-full animate-spin"></div>
        Loading Master Grid...
      </div>
    );

  return (
    <div className="h-screen flex flex-col bg-background text-gray-200 overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-surfaceBorder bg-surface">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">
            Master Schedule Roster
          </h1>
          <div className="flex gap-4 text-sm text-gray-400 mt-1 font-mono">
            <span>
              Target:{" "}
              <strong className="text-status-info">
                {metrics.weeklyAverageCoverage}%
              </strong>
            </span>
            <span>
              Req: <strong>{metrics.totalWeekRequired}h</strong>
            </span>
            <span>
              Sched: <strong>{metrics.totalWeekScheduled}h</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {moveState && (
            <span className="text-status-warning text-sm font-mono animate-pulse border border-status-warning/50 bg-status-warning/10 px-3 py-1 rounded">
              Select an empty cell to drop shift (Press ESC to cancel)
            </span>
          )}
          <Link
            href="/"
            className="px-4 py-2 bg-background border border-surfaceBorder rounded hover:bg-surfaceBorder/50 text-sm font-mono transition-colors"
          >
            ← Back to Intraday
          </Link>
        </div>
      </div>

      {/* The Master Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left border-collapse min-w-max">
          {/* Table Headers with Integrated Metrics! */}
          <thead className="sticky top-0 z-[50] bg-surface shadow-md">
            <tr>
              <th className="p-4 border-b border-r border-surfaceBorder w-[250px] sticky left-0 z-[60] bg-surface">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-mono">
                  Agent Name
                </div>
              </th>
              {metrics.days.map((day: any) => {
                const isOver = day.status === "OVERSTAFFED";
                const isUnder = day.status === "UNDERSTAFFED";
                let colorClass = "text-status-good";
                if (isOver) colorClass = "text-status-danger";
                if (isUnder) colorClass = "text-status-info";

                return (
                  <th
                    key={day.date}
                    className="p-0 border-b border-r border-surfaceBorder min-w-[160px] bg-surface relative"
                  >
                    <div className="flex flex-col items-center justify-center py-3">
                      <span className="font-bold text-white">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                        })}{" "}
                        {day.date.substring(5)}
                      </span>

                      <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                        <span className="text-gray-400">
                          {day.coveragePct}%
                        </span>

                        {/* Action Badge inline in header */}
                        {day.isWithinTolerance ? (
                          <span className="bg-status-good/10 text-status-good px-1.5 py-0.5 rounded">
                            OK
                          </span>
                        ) : (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${isOver ? "bg-status-danger/10 text-status-danger" : "bg-status-info/10 text-status-info"}`}
                          >
                            {day.hoursToMove > 0 ? "+" : ""}
                            {day.hoursToMove}h
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body (Agent Rows) */}
          <tbody className="bg-background">
            {grid.map((agent) => (
              <tr
                key={agent.id}
                className="hover:bg-surface/30 transition-colors border-b border-surfaceBorder group"
              >
                {/* Agent Name Column (Sticky left) */}
                <td className="p-4 border-r border-surfaceBorder sticky left-0 z-[40] bg-background group-hover:bg-surface/50 transition-colors">
                  <div className="font-bold text-gray-200">{agent.name}</div>
                </td>

                {/* The Days */}
                {metrics.days.map((day: any) => {
                  const shift = agent.schedule[day.date];
                  const hasShift = !!shift;

                  // Logic to figure out how this cell should look based on the Move State
                  const isThisAgentActive = moveState?.agentId === agent.id;
                  const isThisShiftSelected =
                    isThisAgentActive && moveState?.sourceDate === day.date;

                  let cellClasses =
                    "p-2 border-r border-surfaceBorder h-full transition-all ";
                  let content = null;

                  if (hasShift) {
                    if (isThisShiftSelected) {
                      cellClasses +=
                        "bg-status-info/20 shadow-[inset_0_0_0_2px_#3b82f6] cursor-pointer";
                    } else if (moveState) {
                      cellClasses += "opacity-30 pointer-events-none"; // Dim other shifts while moving
                    } else {
                      cellClasses += "hover:bg-surface-light cursor-pointer";
                    }

                    content = (
                      <div className="flex flex-col items-center justify-center bg-surface border border-surfaceBorder rounded p-2 shadow-sm pointer-events-none">
                        <span className="text-xs font-mono text-gray-300">
                          {formatTime(shift.start)} - {formatTime(shift.end)}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-0.5">
                          {Math.round((shift.end - shift.start) / 60)}h shift
                        </span>
                      </div>
                    );
                  } else {
                    if (isThisAgentActive) {
                      // This is a DROP ZONE!
                      cellClasses +=
                        "bg-status-good/5 border-2 border-dashed border-status-good/50 cursor-pointer hover:bg-status-good/20";
                      content = (
                        <div className="h-full w-full flex items-center justify-center text-xs font-mono text-status-good font-bold uppercase tracking-widest">
                          Move Here
                        </div>
                      );
                    } else if (moveState) {
                      cellClasses += "opacity-30 pointer-events-none"; // Dim other agents' empty cells
                    } else {
                      cellClasses += "text-gray-600/50";
                      content = (
                        <div className="h-full w-full flex items-center justify-center text-xs font-mono">
                          OFF
                        </div>
                      );
                    }
                  }

                  return (
                    <td
                      key={day.date}
                      className={cellClasses}
                      onClick={() =>
                        handleCellClick(agent.id, day.date, hasShift)
                      }
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
