// components/weekly/WeeklyToolbar.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Link from "next/link";

export type Density = "compact" | "normal" | "large";

interface WeeklyToolbarProps {
  metrics: any;
  grid: any[];
  moveState: any;
  nameSearch: string;
  setNameSearch: (val: string) => void;
  sortBy: string;
  setSortBy: (val: any) => void;
  segmentFilter: string;
  setSegmentFilter: (val: string) => void;
  availableSegments: string[];
  density: Density;
  setDensity: (val: Density) => void;
  isMoving: boolean;
  handleAutoOptimize: () => void;
}

export const WeeklyToolbar: React.FC<WeeklyToolbarProps> = ({
  metrics,
  grid,
  moveState,
  nameSearch,
  setNameSearch,
  sortBy,
  setSortBy,
  segmentFilter,
  setSegmentFilter,
  availableSegments,
  density,
  setDensity,
  isMoving,
  handleAutoOptimize
}) => {
  return (
    <div className="flex justify-between items-center px-8 py-3 border-b border-surfaceBorder bg-surface z-[100]">
      <div>
        <h1 className="text-xl font-medium text-gray-200">Master Schedule Roster</h1>
        <div className="flex gap-4 text-xs text-gray-400 mt-1 tabular-nums">
          <span>Target: <strong className="text-status-info font-medium">{metrics.weeklyAverageCoverage}%</strong></span>
          <span>Req: <strong className="font-medium text-gray-300">{metrics.totalWeekRequired}h</strong></span>
          <span>Sched: <strong className="font-medium text-gray-300">{metrics.totalWeekScheduled}h</strong></span>
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        {moveState && (
          <span className="text-status-warning text-xs font-medium animate-pulse border border-status-warning/30 bg-status-warning/10 px-3 py-1.5 rounded-full shadow-sm tabular-nums">
            From {moveState.sourceDate}: {grid.find(a => a.id === moveState.agentId)?.name} (Press ESC to cancel)
          </span>
        )}

        {/* Segment Filter */}
        <div className="flex items-center gap-2 bg-background border border-surfaceBorder rounded-md px-3 py-1.5 shadow-inner">
          <input 
            type="text" 
            placeholder="Search Agents..." 
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="bg-transparent text-[11px] font-medium text-white placeholder-gray-600 focus:outline-none w-28"
          />
        </div>

        <div className="flex items-center gap-2 bg-background border border-surfaceBorder rounded-md px-3 py-1.5 shadow-inner">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Sort:</span>
          <select 
            className="bg-transparent text-[11px] font-medium text-white focus:outline-none cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Name</option>
            <option value="utilization_desc">Highest Utils.</option>
            <option value="utilization_asc">Lowest Utils.</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-background border border-surfaceBorder rounded-md px-3 py-1.5 shadow-inner hidden xl:flex">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter:</span>
          <select 
            className="bg-transparent text-[11px] font-medium text-white focus:outline-none cursor-pointer"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
          >
            <option value="">All Segments</option>
            {availableSegments.map(seg => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center bg-background border border-surfaceBorder rounded-md overflow-hidden shadow-inner">
          <button onClick={() => setDensity("compact")} className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${density === "compact" ? "bg-status-info text-background" : "text-gray-500 hover:text-gray-300 hover:bg-surface/50"}`}>Small</button>
          <div className="w-px h-3 bg-surfaceBorder"></div>
          <button onClick={() => setDensity("normal")} className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${density === "normal" ? "bg-status-info text-background" : "text-gray-500 hover:text-gray-300 hover:bg-surface/50"}`}>Med</button>
          <div className="w-px h-3 bg-surfaceBorder"></div>
          <button onClick={() => setDensity("large")} className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${density === "large" ? "bg-status-info text-background" : "text-gray-500 hover:text-gray-300 hover:bg-surface/50"}`}>Large</button>
        </div>

        <button
          disabled={isMoving}
          onClick={handleAutoOptimize}
          className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500 hover:text-black transition-colors disabled:opacity-50"
        >
          {isMoving ? "Optimizing..." : "Auto Days Off"}
        </button>

        <Link href="/" className="px-4 py-1.5 bg-background border border-surfaceBorder rounded-md hover:bg-surface/50 text-xs font-medium transition-colors">
          ← Back to Intraday
        </Link>
      </div>
    </div>
  );
};
