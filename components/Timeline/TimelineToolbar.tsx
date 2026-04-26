"use client";

import React from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { generateDeltaExport } from "@/utils/export";
import Link from "next/link";

const HOURS = Array.from({ length: 25 }, (_, i) => ({
  label: `${i.toString().padStart(2, "0")}:00`,
  value: i * 60,
}));

type SortOption = "name" | "startTime";

interface TimelineToolbarProps {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  availableDates: string[];
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  handleForceSync: () => void; // NEW: The function to bust the cache
}

export const TimelineToolbar = ({
  currentDate,
  setCurrentDate,
  availableDates,
  sortBy,
  setSortBy,
  handleForceSync,
}: TimelineToolbarProps) => {
  const timelineStartMin = useScheduleStore((state) => state.timelineStartMin);
  const timelineEndMin = useScheduleStore((state) => state.timelineEndMin);
  const setTimelineBounds = useScheduleStore(
    (state) => state.setTimelineBounds,
  );
  const zoomLevel = useScheduleStore((state) => state.zoomLevel);
  const setZoomLevel = useScheduleStore((state) => state.setZoomLevel);
  const edits = useScheduleStore((state) => state.edits);
  const segments = useScheduleStore((state) => state.segments);
  const originalSegments = useScheduleStore((state) => state.originalSegments);
  const runIntradayOptimization = useScheduleStore((state) => state.runIntradayOptimization);
  const isOptimizing = useScheduleStore((state) => state.isOptimizing);
  const optimizationProgress = useScheduleStore((state) => state.optimizationProgress);

  const handleAutoGST = () => {
    runIntradayOptimization(currentDate);
  };

  const handleExport = () => {
    const csvContent = generateDeltaExport(originalSegments, segments);
    if (!csvContent) {
      alert("No changes to export!");
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `wfm_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <header className="h-auto min-h-16 py-3 border-b border-surfaceBorder flex flex-wrap items-center px-6 justify-between shrink-0 bg-surface z-50 shadow-md gap-4">
      <h1 className="font-heading font-bold text-lg tracking-wide text-white whitespace-nowrap">
        Coverage Optimization Engine
      </h1>

      <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-sm items-center">
        {/* Date Selector & Force Sync Button */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Date:</span>
          <select
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="bg-background border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>

          {/* NEW: Force Sync Button */}
          <button
            onClick={handleForceSync}
            className="p-1.5 ml-1 bg-surfaceBorder/30 text-gray-300 hover:text-status-info hover:bg-status-info/10 rounded transition-colors"
            title="Force re-sync with CSV data"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-background border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer"
          >
            <option value="startTime">Start Time</option>
            <option value="name">Agent Name</option>
          </select>
        </div>

        <div className="hidden md:block w-px h-6 bg-surfaceBorder"></div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">View:</span>
          <select
            value={timelineStartMin}
            onChange={(e) =>
              setTimelineBounds(Number(e.target.value), timelineEndMin)
            }
            className="bg-background border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer"
          >
            {HOURS.filter((h) => h.value < timelineEndMin).map((h) => (
              <option key={`start-${h.value}`} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
          <span className="text-gray-500">to</span>
          <select
            value={timelineEndMin}
            onChange={(e) =>
              setTimelineBounds(timelineStartMin, Number(e.target.value))
            }
            className="bg-background border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer"
          >
            {HOURS.filter((h) => h.value > timelineStartMin).map((h) => (
              <option key={`end-${h.value}`} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:block w-px h-6 bg-surfaceBorder"></div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Zoom:</span>
          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="bg-background border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer"
          >
            <option value={15}>15 Min</option>
            <option value={30}>30 Min</option>
            <option value={60}>1 Hour</option>
          </select>
        </div>

        <div className="hidden md:block w-px h-6 bg-surfaceBorder"></div>

        <div className="flex gap-2">
          <Link href="/constraints">
            <button className="px-3 py-1.5 font-mono text-sm font-bold bg-surfaceBorder/30 text-gray-300 rounded hover:bg-surfaceBorder hover:text-white transition-colors flex items-center gap-2">
              <span>⚙️</span> Rules
            </button>
          </Link>
          <Link href="/edits">
            <button
              className={`px-3 py-1.5 font-mono text-sm font-bold border rounded transition-colors flex items-center gap-2 ${edits.length > 0 ? "bg-status-info/20 text-status-info border-status-info/30 hover:bg-status-info hover:text-white" : "bg-surfaceBorder/30 text-gray-300 border-transparent hover:bg-surfaceBorder hover:text-white"}`}
            >
              <span>📝</span> Edits ({edits.length})
            </button>
          </Link>
          <button
            onClick={handleAutoGST}
            disabled={isOptimizing}
            className="relative overflow-hidden px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500 hover:text-black transition-colors disabled:opacity-100 disabled:cursor-not-allowed"
          >
            {isOptimizing && (
              <div 
                className="absolute inset-0 bg-amber-500/40 transition-all duration-200 pointer-events-none" 
                style={{ width: `${optimizationProgress}%` }}
              ></div>
            )}
            <span className="relative z-10">{isOptimizing ? `Optimizing... ${Math.round(optimizationProgress)}%` : "Auto GST"}</span>
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest font-bold bg-status-good/20 text-status-good border border-status-good/30 rounded hover:bg-status-good hover:text-black transition-colors"
          >
            Export Sync
          </button>
        </div>
      </div>
    </header>
  );
};
