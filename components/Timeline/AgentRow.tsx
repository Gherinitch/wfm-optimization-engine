// components/Timeline/AgentRow.tsx
"use client";

import { useState } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { useShallow } from "zustand/react/shallow";
import { SegmentBlock } from "./SegmentBlock";

export interface DragState {
  segmentId: string;
  category: string;
  offsetMins: number;
}

export const AgentRow = ({ agentId }: { agentId: string }) => {
  const agentName = useScheduleStore((state) => state.agents[agentId]?.name);
  const timelineStartMin = useScheduleStore((state) => state.timelineStartMin);
  const timelineEndMin = useScheduleStore((state) => state.timelineEndMin);
  const ppm = useScheduleStore((state) => state.pixelsPerMinute);
  const zoomLevel = useScheduleStore((state) => state.zoomLevel);
  const selectedDate = useScheduleStore((state) => state.selectedDate);

  const setSelectedAgentId = useScheduleStore((state) => state.setSelectedAgentId);
  const setPendingSwap = useScheduleStore((state) => state.setPendingSwap);

  // FIXED: Row-level drag state to allow group dragging
  const [dragState, setDragState] = useState<DragState | null>(null);

  const sortedSegments = useScheduleStore(
    useShallow((state) => {
      const ag = state.agents[agentId];
      if (!ag) return [];

      const todays = ag.segments.filter((segId) => {
        const seg = state.segments[segId];
        return seg && seg.date === state.selectedDate;
      });

      return todays.sort((a, b) => {
        const segA = state.segments[a];
        const segB = state.segments[b];
        if (!segA || !segB) return 0;
        if (segA.rank !== segB.rank) return segB.rank - segA.rank;
        return segB.endMin - segB.startMin - (segA.endMin - segA.startMin);
      });
    }),
  );

  if (!agentName) return null;

  const trackWidth = (timelineEndMin - timelineStartMin) * ppm;

  return (
    <div className="flex w-full border-b border-surfaceBorder bg-surface hover:bg-surfaceBorder/30 transition-colors h-12 relative hover:z-50 group/row">
      <div className="w-64 flex-shrink-0 sticky left-0 z-[100000] bg-surface border-r border-surfaceBorder flex items-center justify-between px-4 transition-colors group-hover/row:bg-surfaceBorder/50">
        <div onClick={() => setSelectedAgentId(agentId)} className="flex flex-col truncate cursor-pointer flex-grow" title="Click to view weekly schedule">
          <span className="font-heading font-semibold text-sm truncate text-white hover:text-status-info transition-colors">{agentName}</span>
          <span className="font-mono text-[10px] text-gray-500">{agentId}</span>
        </div>

        <button onClick={() => setPendingSwap({ sourceAgentId: agentId, targetAgentId: null, date: selectedDate })} className="opacity-0 group-hover/row:opacity-100 p-1.5 bg-surfaceBorder/50 hover:bg-status-info/20 text-gray-400 hover:text-status-info rounded transition-all shrink-0 ml-2" title="Reassign or Swap Shift">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
        </button>
      </div>

      <div className="relative flex-grow min-w-full bg-transparent" style={{ width: trackWidth }}>
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `linear-gradient(to right, #4b5563 1px, transparent 1px)`,
            backgroundSize: `${zoomLevel * ppm}px 100%`,
          }}
        />
        {sortedSegments.map((segId) => (
          <SegmentBlock 
            key={segId} 
            segmentId={segId} 
            dragState={dragState} 
            setDragState={setDragState} 
          />
        ))}
      </div>
    </div>
  );
};