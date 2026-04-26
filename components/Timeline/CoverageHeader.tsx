// components/Timeline/CoverageHeader.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { formatTime, formatMetric } from "@/utils/time";
import { useMemo } from "react";

export const CoverageHeader = () => {
  const zoomLevel = useScheduleStore((state) => state.zoomLevel);
  const getAggregatedMetrics = useScheduleStore(
    (state) => state.getAggregatedMetrics,
  );
  const timelineStartMin = useScheduleStore((state) => state.timelineStartMin);
  const timelineEndMin = useScheduleStore((state) => state.timelineEndMin);
  const ppm = useScheduleStore((state) => state.pixelsPerMinute);


  const slots = useMemo(() => {
    const s = [];
    for (let i = timelineStartMin; i < timelineEndMin; i += zoomLevel)
      s.push(i);
    return s;
  }, [zoomLevel, timelineStartMin, timelineEndMin]);

  const trackWidth = (timelineEndMin - timelineStartMin) * ppm;
  const slotWidth = zoomLevel * ppm;

  return (
    <div className="flex w-full border-b border-surfaceBorder bg-background">
      {/* FIXED: Z-Index set to [100000] */}
      <div className="w-64 flex-shrink-0 sticky left-0 z-[100000] bg-surface border-r border-surfaceBorder p-4 flex flex-col justify-end">
        <span className="font-heading text-xs text-gray-400 uppercase tracking-widest font-semibold">
          Net Coverage
        </span>
      </div>

      <div className="relative flex-grow flex" style={{ width: trackWidth }}>
        {slots.map((slot) => {
          const { scheduled, required } = getAggregatedMetrics(slot, zoomLevel);

          const safeRequired = formatMetric(required);
          const safeScheduled = formatMetric(scheduled);
          const netCoverage = formatMetric(safeScheduled - safeRequired);

          let bgColor = "bg-surface";
          let textColor = "text-gray-400";
          if (safeRequired > 0) {
            if (netCoverage < 0) {
              bgColor = "bg-status-danger/20";
              textColor = "text-status-danger";
            } else if (netCoverage === 0) {
              bgColor = "bg-status-good/20";
              textColor = "text-status-good";
            } else {
              bgColor = "bg-status-info/20";
              textColor = "text-status-info";
            }
          }

          return (
            <div
              key={slot}
              className={`group relative flex flex-col border-r border-surfaceBorder transition-colors h-16 ${bgColor}`}
              style={{ width: slotWidth, minWidth: slotWidth }}
            >
              <div className="h-6 border-b border-surfaceBorder/50 flex items-center justify-center bg-background/50 backdrop-blur-sm overflow-hidden">
                <span className="text-[11px] font-mono text-gray-500">
                  {formatTime(slot)}
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center cursor-help">
                <span className={`text-sm font-mono font-bold ${textColor}`}>
                  {netCoverage > 0 ? `+${netCoverage}` : netCoverage}
                </span>
              </div>

              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:flex flex-col bg-surface border border-surfaceBorder rounded-md p-3 text-xs z-[100] shadow-2xl w-40 pointer-events-none">
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-400">Required</span>
                  <span className="font-mono">{safeRequired}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-400">Scheduled</span>
                  <span className="font-mono">{safeScheduled}</span>
                </div>
                <div className="flex justify-between py-0.5 font-bold mt-1 pt-1 border-t border-surfaceBorder/50">
                  <span className="text-gray-400">Net</span>
                  <span className={`font-mono ${textColor}`}>
                    {netCoverage > 0 ? `+${netCoverage}` : netCoverage}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
