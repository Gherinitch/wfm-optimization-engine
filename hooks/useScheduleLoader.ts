// hooks/useScheduleLoader.ts
import { useState, useEffect } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { parseScheduleData, fetchAvailableDates } from "@/utils/parser";
import { importWfmDataToSqlite, fetchDayFromSqlite } from "@/utils/hydration";
import { dbClient } from "@/utils/dbClient";
import { logger } from "@/utils/logger";

export function useScheduleLoader() {
  const loadedDate = useScheduleStore((state) => state.loadedDate);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // 1. Initialize the Database Worker once
  useEffect(() => {
    dbClient.init();
  }, []);

  // 2. Fetch the available dates for the dropdown
  useEffect(() => {
    fetchAvailableDates().then((dates) => {
      setAvailableDates(dates);
      if (dates.length > 0) setCurrentDate(dates[0]);
    });
  }, []);

  // 3. The Smart Loader (SQLite first, CSV fallback)
  useEffect(() => {
    if (!currentDate) return;

    if (loadedDate === currentDate) {
      useScheduleStore.getState().setSelectedDate(currentDate);
      useScheduleStore.getState().autoFitBounds();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHydrated(true);
      return;
    }

    const loadData = async () => {
      setIsHydrated(false);
      const dbData = await fetchDayFromSqlite(currentDate);

      if (Object.keys(dbData.agents).length === 0) {
        logger.warn("SQLite is empty. Initializing from CSV...");
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
      } else {
        logger.info("Successfully loaded day from SQLite!");
        useScheduleStore
          .getState()
          .setHydratedData(
            currentDate,
            dbData.agents,
            dbData.segments,
            dbData.requirements,
            dbData.edits,
          );
      }

      useScheduleStore.getState().autoFitBounds();
      setIsHydrated(true);
    };

    loadData();
  }, [currentDate, loadedDate]);

  // 4. The Force Sync Action
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

  return {
    isHydrated,
    currentDate,
    setCurrentDate,
    availableDates,
    handleForceSync,
  };
}
