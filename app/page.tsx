// app/page.tsx
"use client";
"use no memo";

import { useRef, useState, useMemo, useEffect } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useScheduleStore } from "@/store/useScheduleStore";

import { CoverageHeader } from "@/components/Timeline/CoverageHeader";
import { GSTHeader } from "@/components/Timeline/GSTHeader";
import { AgentRow } from "@/components/Timeline/AgentRow";
import { ValidationModal } from "@/components/Timeline/ValidationModal";
import { TimelineToolbar } from "@/components/Timeline/TimelineToolbar";
import { AgentContextModal } from "@/components/Timeline/AgentContextModal";
import { SwapModal } from "@/components/Timeline/SwapModal";
import { IntradayOptimizerModal } from "@/components/Timeline/IntradayOptimizerModal";

// Our clean new hooks!
import { useScheduleLoader } from "@/hooks/useScheduleLoader";
import { useAgentSort } from "@/hooks/useAgentSort";
import { fetchAvailableWorkSegments } from "@/utils/hydration";

export default function OptimizationTool() {
  const {
    isHydrated,
    currentDate,
    setCurrentDate,
    availableDates,
    handleForceSync,
  } = useScheduleLoader();
  
  const { sortBy, setSortBy, sortedAgentIds } = useAgentSort(currentDate);

  const agents = useScheduleStore(state => state.agents);
  const segments = useScheduleStore(state => state.segments);

  // Filter State
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<string>("");

  useEffect(() => {
    if (isHydrated) {
      fetchAvailableWorkSegments().then(setAvailableSegments);
    }
  }, [isHydrated]);

  // Apply the segment filter to our sorted agents
  const filteredAgentIds = useMemo(() => {
    let list = sortedAgentIds;
    if (segmentFilter) {
      list = list.filter(agentId => {
        const agent = agents[agentId];
        // Check if the agent has this specific segment on the currently viewed date
        return agent?.segments.some(segId => 
          segments[segId]?.name === segmentFilter && segments[segId]?.date === currentDate
        );
      });
    }
    return list;
  }, [sortedAgentIds, segmentFilter, agents, segments, currentDate]);

  // The Virtualizer Setup!
  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: filteredAgentIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // The height of the AgentRow (h-12 in Tailwind is exactly 48px)
    overscan: 10, // Buffer extra rows outside the viewport to prevent flickering
  });

  if (!isHydrated) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center font-mono text-status-info">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-status-info border-t-transparent rounded-full animate-spin"></div>
          Loading WFM Data...
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background text-gray-200 selection:bg-status-info/30">
      <ValidationModal />
      <AgentContextModal />
      <SwapModal />
      <IntradayOptimizerModal />

      <TimelineToolbar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        availableDates={availableDates}
        sortBy={sortBy}
        setSortBy={setSortBy}
        handleForceSync={handleForceSync}
      />

      {/* The Segment Filter Bar */}
      <div className="px-6 py-2 bg-surface/80 border-b border-surfaceBorder flex items-center gap-3 z-40">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter by Work Segment:</span>
        <select 
          className="bg-background border border-surfaceBorder text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-status-info cursor-pointer transition-colors hover:border-surfaceBorder/80"
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
        >
          <option value="">All Segments</option>
          {availableSegments.map(seg => (
            <option key={seg} value={seg}>{seg}</option>
          ))}
        </select>
        
        {segmentFilter && (
          <span className="text-xs font-mono text-status-info ml-2">
            Showing {filteredAgentIds.length} Agents
          </span>
        )}
      </div>

      {/* The Virtualized Scroll Container */}
      <div ref={parentRef} className="flex-grow overflow-auto flex flex-col relative custom-scrollbar bg-surface/50 will-change-scroll">
        <div className="min-w-max pb-20">
          
          {/* Headers remain sticky at the top */}
          <div className="sticky top-0 z-[100001] shadow-md flex flex-col bg-background">
            <CoverageHeader />
            <GSTHeader />
          </div>

          {/* The Virtualized Body! */}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }} className="z-0">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const agentId = filteredAgentIds[virtualRow.index];
              return (
                <div 
                  key={agentId}
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    transform: `translateY(${virtualRow.start}px)` 
                  }}
                >
                  <AgentRow agentId={agentId} />
                </div>
              );
            })}
          </div>
          
        </div>
      </div>
    </main>
  );
}