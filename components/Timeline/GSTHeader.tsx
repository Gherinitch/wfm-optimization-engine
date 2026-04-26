// components/Timeline/GSTHeader.tsx
"use client";

import { useScheduleStore } from "@/store/useScheduleStore";
import { formatTime, formatMetric } from "@/utils/time";
import { useMemo } from "react";

export const GSTHeader = () => {
  const getAggregatedMetrics = useScheduleStore(
    (state) => state.getAggregatedMetrics,
  );
  const timelineStartMin = useScheduleStore((state) => state.timelineStartMin);
  const timelineEndMin = useScheduleStore((state) => state.timelineEndMin);
  const ppm = useScheduleStore((state) => state.pixelsPerMinute);


  const slots = useMemo(() => {
    const s = [];
    const roundedStart = Math.floor(timelineStartMin / 60) * 60;
    for (let i = roundedStart; i < timelineEndMin; i += 60) {
      if (i + 60 > timelineStartMin) s.push(i);
    }
    return s;
  }, [timelineStartMin, timelineEndMin]);

  const trackWidth = (timelineEndMin - timelineStartMin) * ppm;

  return (
    <div className="flex w-full border-b border-surfaceBorder bg-surface h-10">
      <div className="w-64 flex-shrink-0 sticky left-0 z-[100000] bg-surface border-r border-surfaceBorder px-4 flex flex-col justify-center">
        <span className="font-heading text-xs text-gray-400 uppercase tracking-widest font-semibold">
          GST (1H)
        </span>
      </div>

      <div className="relative flex-grow flex" style={{ width: trackWidth }}>
        {slots.map((slot) => {
          // Destructure the new varianceMins property
          const { gst, varianceMins } = getAggregatedMetrics(slot, 60);
          const startRender = Math.max(slot, timelineStartMin);
          const endRender = Math.min(slot + 60, timelineEndMin);
          const renderWidth = endRender - startRender;

          if (renderWidth <= 0) return null;

          const gstPercentage = formatMetric(gst * 100);

          let textColor = "text-status-good";
          if (gst < 0.7) textColor = "text-status-danger";

          const varianceText = varianceMins > 0 ? `+${varianceMins}m` : `${varianceMins}m`;

          return (
            <div
              key={slot}
              // Added gap-1.5 to cleanly separate the % and the variance marker
              className="flex items-center justify-center border-r border-surfaceBorder/30 gap-1.5"
              style={{ width: renderWidth * ppm }}
              title={`GST for ${formatTime(slot)} - ${formatTime(slot + 60)}. Variance from target: ${varianceText}`}
            >
              <span className={`text-sm font-mono font-bold ${textColor}`}>
                {gstPercentage}%
              </span>
              
              {/* FIXED: Non-intrusive variance indicator */}
              {varianceMins !== 0 && (
                <span 
                  className="text-[10px] font-mono text-gray-500/80 font-medium select-none" 
                  title={`${Math.abs(varianceMins)} mins ${varianceMins > 0 ? 'over' : 'under'} ideal curve`}
                >
                  {varianceText}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};