// app/page.tsx
"use client";

import { CoverageHeader } from "@/components/Timeline/CoverageHeader";
import { GSTHeader } from "@/components/Timeline/GSTHeader";
import { AgentRow } from "@/components/Timeline/AgentRow";
import { ValidationModal } from "@/components/Timeline/ValidationModal";
import { TimelineToolbar } from "@/components/Timeline/TimelineToolbar";
import { AgentContextModal } from "@/components/Timeline/AgentContextModal";
import { SwapModal } from "@/components/Timeline/SwapModal";

// 🚀 Our clean new hooks!
import { useScheduleLoader } from "@/hooks/useScheduleLoader";
import { useAgentSort } from "@/hooks/useAgentSort";

export default function OptimizationTool() {
  const {
    isHydrated,
    currentDate,
    setCurrentDate,
    availableDates,
    handleForceSync,
  } = useScheduleLoader();
  const { sortBy, setSortBy, sortedAgentIds } = useAgentSort(currentDate);

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

      <TimelineToolbar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        availableDates={availableDates}
        sortBy={sortBy}
        setSortBy={setSortBy}
        handleForceSync={handleForceSync}
      />

      <div className="flex-grow overflow-auto flex flex-col relative custom-scrollbar bg-surface/50">
        <div className="min-w-max pb-20">
          <div className="sticky top-0 z-[100001] shadow-md flex flex-col bg-background">
            <CoverageHeader />
            <GSTHeader />
          </div>

          <div className="flex flex-col relative z-0">
            {sortedAgentIds.map((agentId) => (
              <AgentRow key={agentId} agentId={agentId} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
