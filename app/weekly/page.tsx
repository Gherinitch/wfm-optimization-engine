// app/weekly/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
"use no memo";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { fetchDateRangeMetrics, fetchFullWeeklyGrid, executeInterdayMove, fetchAvailableWorkSegments, autoOptimizeWeek } from "@/utils/hydration";
import { dbClient } from "@/utils/dbClient";
import Link from "next/link";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScheduleStore } from "@/store/useScheduleStore";
import { InterdayOptimizerModal } from "@/components/Timeline/InterdayOptimizerModal";
import { AgentRow } from "@/components/weekly/AgentRow";
import { Density, WeeklyToolbar } from "@/components/weekly/WeeklyToolbar";

const getDStyles = (density: Density) => ({
  compact: { thPad: "py-2 px-3", cellPad: "px-2 py-1.5", headerDate: "text-xs", headerCov: "text-sm", agentText: "text-xs", shiftText: "text-[11px]", showDuration: false, minHeight: "min-h-[28px]", actionBadge: "text-[10px] px-1 py-0.5", rowHeight: 45 },
  normal: { thPad: "py-3 px-4", cellPad: "px-3 py-2", headerDate: "text-sm", headerCov: "text-base", agentText: "text-sm", shiftText: "text-xs", showDuration: true, minHeight: "min-h-[36px]", actionBadge: "text-[11px] px-1.5 py-0.5", rowHeight: 60 },
  large: { thPad: "py-4 px-5", cellPad: "px-4 py-3", headerDate: "text-base", headerCov: "text-lg", agentText: "text-base", shiftText: "text-sm", showDuration: true, minHeight: "min-h-[48px]", actionBadge: "text-xs px-2 py-1", rowHeight: 80 }
}[density]);

export default function WeeklyBalancing() {
  const [metrics, setMetrics] = useState<any>(null);
  const [grid, setGrid] = useState<any[]>([]);
  const [isEmpty, setIsEmpty] = useState(false);
  const [density, setDensity] = useState<Density>("normal");

  // Filter State
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "utilization_desc" | "utilization_asc">("name");

  const setPendingInterdayOptimization = useScheduleStore(state => state.setPendingInterdayOptimization);

  const [moveState, setMoveState] = useState<{ agentId: string; sourceDate: string } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const moveStateRef = useRef(moveState);
  const isMovingRef = useRef(isMoving);
  
  useEffect(() => { moveStateRef.current = moveState; }, [moveState]);
  useEffect(() => { isMovingRef.current = isMoving; }, [isMoving]);

  const loadData = useCallback(async () => {
    await dbClient.init();
    const bounds = await dbClient.query(`SELECT MIN(date) as minDate, MAX(date) as maxDate FROM requirements`);
    if (!bounds[0] || !bounds[0].minDate) {
      setIsEmpty(true);
      return;
    }

    const dynamicStart = bounds[0].minDate;
    const dynamicEnd = bounds[0].maxDate;


    // Fetch the metrics, the filtered grid, and the dropdown segments
    const [metricsData, gridData, segmentsData] = await Promise.all([
      fetchDateRangeMetrics(dynamicStart, dynamicEnd),
      fetchFullWeeklyGrid(dynamicStart, dynamicEnd, segmentFilter),
      fetchAvailableWorkSegments()
    ]);
    
    setMetrics(metricsData);
    setGrid(gridData);
    setAvailableSegments(segmentsData);
  }, [segmentFilter]); // Re-run loadData whenever the filter changes

  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);
  useEffect(() => { loadData(); }, [loadData]);

  const handleAutoOptimize = async () => {
    if (metrics?.days?.length > 0) {
      setIsMoving(true);
      const start = metrics.days[0].date;
      const end = metrics.days[metrics.days.length - 1].date;
      const moves = await autoOptimizeWeek(start, end);
      if (moves && moves.length > 0) {
        setPendingInterdayOptimization({ startDate: start, endDate: end, moves });
      } else {
        alert("The schedule is fully balanced or optimally constrained.");
      }
      setIsMoving(false);
    }
  };

  const handleCellClick = useCallback(async (agentId: string, date: string, hasShift: boolean) => {
    if (isMovingRef.current) return;
    const currentMove = moveStateRef.current;

    if (hasShift) {
      if (currentMove?.agentId === agentId && currentMove?.sourceDate === date) {
        setMoveState(null); 
      } else {
        setMoveState({ agentId, sourceDate: date }); 
      }
    } else {
      if (currentMove?.agentId === agentId) {
        setIsMoving(true);
        await executeInterdayMove(agentId, currentMove.sourceDate, date);
        setMoveState(null);
        await loadDataRef.current();
        setIsMoving(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoveState(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const dStyles = useMemo(() => getDStyles(density), [density]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const processedGrid = useMemo(() => {
    let result = [...grid];
    
    if (nameSearch) {
      const q = nameSearch.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q));
    }
    
    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "utilization_desc") {
      result.sort((a, b) => b.totalWorkHours - a.totalWorkHours);
    } else if (sortBy === "utilization_asc") {
      result.sort((a, b) => a.totalWorkHours - b.totalWorkHours);
    }
    
    return result;
  }, [grid, nameSearch, sortBy]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: processedGrid.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => dStyles.rowHeight,
    overscan: 5,
  });

  if (isEmpty) return (
    <div className="h-screen w-screen bg-background flex flex-col items-center justify-center font-mono text-status-danger gap-4">
      <div>⚠️ No data found in the database.</div>
      <Link href="/" className="px-6 py-3 bg-surface border border-surfaceBorder rounded-lg text-white hover:bg-surfaceBorder transition-colors">Go to Intraday to load data</Link>
    </div>
  );

  if (!metrics || !availableSegments) return (
    <div className="h-screen w-screen bg-background flex items-center justify-center font-mono text-status-info gap-4 text-xl">
      <div className="w-8 h-8 border-4 border-status-info border-t-transparent rounded-full animate-spin"></div>
      Loading Master Grid...
    </div>
  );

  const gridColsStyle = {
    display: 'grid',
    gridTemplateColumns: `200px repeat(${metrics.days.length}, minmax(160px, 1fr))`
  };

  return (
    <div className="h-screen flex flex-col bg-background text-gray-200 overflow-hidden font-sans">
      <InterdayOptimizerModal onComplete={loadData} />
      
      <WeeklyToolbar
        metrics={metrics}
        grid={grid}
        moveState={moveState}
        nameSearch={nameSearch}
        setNameSearch={setNameSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        segmentFilter={segmentFilter}
        setSegmentFilter={setSegmentFilter}
        availableSegments={availableSegments}
        density={density}
        setDensity={setDensity}
        isMoving={isMoving}
        handleAutoOptimize={handleAutoOptimize}
      />

      <div ref={parentRef} className="flex-1 overflow-auto custom-scrollbar relative will-change-scroll">
        <div style={{ minWidth: 'fit-content' }} className="group/table" data-moving={!!moveState}>
          
          {/* CSS Grid Header */}
          <div style={gridColsStyle} className="sticky top-0 z-[50] border-b-2 border-surfaceBorder bg-surface shadow-sm w-full">
            <div className={`${dStyles.thPad} border-r border-surfaceBorder sticky left-0 z-[60] bg-surface transform-gpu flex items-center`}>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Agent</div>
            </div>
            
            {metrics.days.map((day: any) => {
              const isOver = day.status === "OVERSTAFFED";
              const isUnder = day.status === "UNDERSTAFFED";
              let colorClass = "text-gray-300"; 
              if (isOver) colorClass = "text-status-danger";
              if (isUnder) colorClass = "text-status-info";

              return (
                <div key={day.date} className="border-r border-surfaceBorder bg-surface bg-clip-padding relative flex flex-col items-center justify-center">
                  <div className={`flex flex-col items-center justify-center ${dStyles.thPad} w-full`}>
                    <span className={`font-medium text-gray-100 ${dStyles.headerDate}`}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })} <span className="text-gray-500 text-[0.85em] font-normal tabular-nums">{day.date.substring(5)}</span>
                    </span>
                    <div className="flex items-center gap-1.5 mt-1 tabular-nums">
                      <span className={`font-medium ${colorClass} ${dStyles.headerCov}`}>{day.coveragePct}%</span>
                      {!day.isWithinTolerance && (
                        <span className={`rounded font-medium ${dStyles.actionBadge} ${isOver ? 'bg-status-danger/10 text-status-danger' : 'bg-status-info/10 text-status-info'}`}>
                          {day.hoursToMove > 0 ? '+' : ''}{day.hoursToMove}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {grid.length === 0 ? (
             <div className="flex items-center justify-center h-40 text-gray-500 font-mono text-sm">
               No agents scheduled with the selected filter.
             </div>
          ) : (
            <div 
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }} 
              className="bg-background"
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const agent = processedGrid[virtualRow.index];
                return (
                  <AgentRow 
                    key={agent.id} 
                    agent={agent} 
                    metrics={metrics} 
                    dStyles={dStyles} 
                    activeMove={moveState?.agentId === agent.id ? moveState : null} 
                    onCellClick={handleCellClick}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    gridColsStyle={gridColsStyle}
                  />
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}