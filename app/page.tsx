// app/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { CoverageHeader } from "@/components/Timeline/CoverageHeader";
import { GSTHeader } from "@/components/Timeline/GSTHeader";
import { AgentRow } from "@/components/Timeline/AgentRow";
import { ValidationModal } from "@/components/Timeline/ValidationModal";
import { TimelineToolbar } from "@/components/Timeline/TimelineToolbar";
import { parseScheduleData, fetchAvailableDates } from "@/utils/parser";
import { AgentContextModal } from "@/components/Timeline/AgentContextModal";
import { SwapModal } from "@/components/Timeline/SwapModal";
import { dbClient } from "@/utils/dbClient";
import { importWfmDataToSqlite, fetchDayFromSqlite } from "@/utils/hydration";

type SortOption = "name" | "startTime";

export default function OptimizationTool() {
  useEffect(() => {
    dbClient.init();
  }, []);

  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);
  const loadedDate = useScheduleStore((state) => state.loadedDate);

  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("startTime");

  useEffect(() => {
    fetchAvailableDates().then((dates) => {
      setAvailableDates(dates);
      if (dates.length > 0) setCurrentDate(dates[0]);
    });
  }, []);

  // 🚀 THE SMART LOADER: Read from SQLite first!
  useEffect(() => {
    if (!currentDate) return;

    if (loadedDate === currentDate) {
      useScheduleStore.getState().setSelectedDate(currentDate);
      useScheduleStore.getState().autoFitBounds();
      setIsHydrated(true);
      return;
    }

    const loadData = async () => {
      setIsHydrated(false);

      // 1. Try to fetch the day from SQLite
      const dbData = await fetchDayFromSqlite(currentDate);

      // 2. If SQLite is empty, fall back to parsing the CSV
      if (Object.keys(dbData.agents).length === 0) {
        console.warn("⚠️ SQLite is empty. Initializing from CSV...");
        const csvData = await parseScheduleData(currentDate);

        // Backup the CSV to SQLite immediately
        await importWfmDataToSqlite(
          csvData.agents,
          csvData.segments,
          csvData.requirements,
        );

        useScheduleStore
          .getState()
          .setHydratedData(
            currentDate,
            csvData.agents,
            csvData.segments,
            csvData.requirements,
          );
      } else {
        // 3. Success! Load the data seamlessly from SQLite (including the EDITS!)
        console.log("✅ Successfully loaded day from SQLite!");
        useScheduleStore.getState().setHydratedData(
          currentDate,
          dbData.agents,
          dbData.segments,
          dbData.requirements,
          dbData.edits, // <-- Edits are restored!
        );
      }

      useScheduleStore.getState().autoFitBounds();
      setIsHydrated(true);
    };

    loadData();
  }, [currentDate, loadedDate]);

  const handleForceSync = () => {
    if (!currentDate) return;
    const forceLoad = async () => {
      setIsHydrated(false);
      const csvData = await parseScheduleData(currentDate);
      await importWfmDataToSqlite(
        csvData.agents,
        csvData.segments,
        csvData.requirements,
      );
      useScheduleStore
        .getState()
        .setHydratedData(
          currentDate,
          csvData.agents,
          csvData.segments,
          csvData.requirements,
          [],
        );
      useScheduleStore.getState().autoFitBounds();
      setIsHydrated(true);
    };
    forceLoad();
  };

  const sortedAgentIds = useMemo(() => {
    const agentList = Object.values(agents);
    if (sortBy === "name")
      return agentList
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => a.id);

    if (sortBy === "startTime") {
      return agentList
        .sort((a, b) => {
          const aTodays = a.segments.filter(
            (id) => segments[id]?.date === currentDate,
          );
          const bTodays = b.segments.filter(
            (id) => segments[id]?.date === currentDate,
          );

          const startA =
            aTodays.length > 0
              ? Math.min(...aTodays.map((id) => segments[id].startMin))
              : Infinity;
          const startB =
            bTodays.length > 0
              ? Math.min(...bTodays.map((id) => segments[id].startMin))
              : Infinity;

          if (startA === startB) return a.name.localeCompare(b.name);
          return startA - startB;
        })
        .map((a) => a.id);
    }
    return agentList.map((a) => a.id);
  }, [agents, segments, sortBy, currentDate]);

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
