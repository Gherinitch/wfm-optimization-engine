// hooks/useAgentSort.ts
import { useState, useMemo } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";

export type SortOption = "name" | "startTime";

export function useAgentSort(currentDate: string) {
  const [sortBy, setSortBy] = useState<SortOption>("startTime");
  const agents = useScheduleStore((state) => state.agents);
  const segments = useScheduleStore((state) => state.segments);

  const sortedAgentIds = useMemo(() => {
    const agentList = Object.values(agents);

    if (sortBy === "name") {
      return agentList
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => a.id);
    }

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

  return {
    sortBy,
    setSortBy,
    sortedAgentIds,
  };
}
