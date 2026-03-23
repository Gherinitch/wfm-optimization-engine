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
  const segments = useScheduleStore((state) => state.segments);

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
    // Set a clean, fixed height
    <div className="flex w-full border-b border-surfaceBorder bg-surface h-10">
      {/* Matched the p-4 padding to align perfectly with the Net Coverage sidebar */}
      <div className="w-64 flex-shrink-0 sticky left-0 z-40 bg-surface border-r border-surfaceBorder px-4 flex flex-col justify-center">
        <span className="font-heading text-xs text-gray-400 uppercase tracking-widest font-semibold">
          GST (1H)
        </span>
      </div>

      <div className="relative flex-grow flex" style={{ width: trackWidth }}>
        {slots.map((slot) => {
          const { gst } = getAggregatedMetrics(slot, 60);
          const startRender = Math.max(slot, timelineStartMin);
          const endRender = Math.min(slot + 60, timelineEndMin);
          const renderWidth = endRender - startRender;

          if (renderWidth <= 0) return null;

          const gstPercentage = formatMetric(gst * 100);

          // YOUR NEW LOGIC
          let textColor = "text-status-good";
          if (gst < 0.7) textColor = "text-status-danger";

          return (
            <div
              key={slot}
              className="flex items-center justify-center border-r border-surfaceBorder/30"
              style={{ width: renderWidth * ppm }}
              title={`GST for ${formatTime(slot)} - ${formatTime(slot + 60)}`}
            >
              {/* Matched the exact font styling of the Net Coverage numbers */}
              <span className={`text-sm font-mono font-bold ${textColor}`}>
                {gstPercentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
