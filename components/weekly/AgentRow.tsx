// components/weekly/AgentRow.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo } from "react";
import { Z_INDEX } from "@/constants/ui";
import { formatTime } from "@/utils/time";
import { MINS_PER_HOUR } from "@/constants/wfm";

export const AgentRow = memo(
  ({
    agent,
    metrics,
    dStyles,
    activeMove,
    onCellClick,
    style,
    gridColsStyle,
  }: any) => {
    return (
      <div
        style={{ ...style, ...gridColsStyle }}
        className="hover:bg-surface/40 border-b border-surfaceBorder/50 group/row absolute top-0 left-0 w-full"
      >
        <div
          className={`${dStyles.cellPad} border-r border-surfaceBorder/50 sticky left-0 bg-background group-hover/row:bg-surface transform-gpu transition-opacity duration-150 flex flex-col justify-center ${!activeMove ? "group-data-[moving=true]/table:opacity-30" : "!opacity-100"}`}
          style={{ zIndex: Z_INDEX.TABLE_STICKY_LEFT }}
        >
          <div
            className={`font-medium text-gray-300 truncate w-full ${dStyles.agentText}`}
          >
            {agent.name}
          </div>
          <div className="text-[10px] text-gray-500 font-mono tracking-tighter tabular-nums mt-0.5">
            {agent.totalWorkHours}h utilized
          </div>
        </div>

        {metrics.days.map((day: any) => {
          const shift = agent.schedule[day.date];
          const hasShift = !!shift;
          const isThisShiftSelected = activeMove?.sourceDate === day.date;

          let cellClasses = `${dStyles.cellPad} border-r border-surfaceBorder/50 flex items-center justify-center transition-opacity duration-150 `;
          let content = null;

          if (hasShift) {
            const isMorning = shift.start < 720;
            const themeClasses = isMorning
              ? "border-l-4 border-l-amber-500/90 bg-amber-900/40 text-gray-100 border-t border-b border-r border-amber-900/50"
              : "border-l-4 border-l-indigo-400/90 bg-indigo-950/40 text-gray-100 border-t border-b border-r border-indigo-950/50";
            const shiftIcon = isMorning ? "☀️" : "🌙";

            if (isThisShiftSelected) {
              cellClasses += "!opacity-100 cursor-pointer";
            } else {
              cellClasses +=
                "hover:opacity-80 cursor-pointer group-data-[moving=true]/table:opacity-20 group-data-[moving=true]/table:pointer-events-none";
            }

            content = (
              <div
                className={`flex items-center justify-center gap-1.5 rounded-r px-2 py-1 shadow-sm pointer-events-none w-full h-full ${themeClasses} ${isThisShiftSelected ? "ring-2 ring-white shadow-xl brightness-125" : ""}`}
              >
                <span className="text-[1.1em] leading-none">{shiftIcon}</span>
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span
                    className={`${dStyles.shiftText} tabular-nums font-medium tracking-tight`}
                  >
                    {formatTime(shift.start)} - {formatTime(shift.end)}
                  </span>
                  {dStyles.showDuration && (
                    <span className="text-[10px] tabular-nums opacity-60 font-normal">
                      {Math.round((shift.end - shift.start) / MINS_PER_HOUR)}h
                    </span>
                  )}
                </div>
              </div>
            );
          } else {
            if (activeMove) {
              cellClasses +=
                "!opacity-100 bg-status-good/5 border-2 border-dashed border-status-good/30 cursor-pointer hover:bg-status-good/10 p-1";
              content = (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-medium uppercase tracking-widest text-status-good tabular-nums">
                  Drop
                </div>
              );
            } else {
              cellClasses +=
                "text-surfaceBorder/40 group-data-[moving=true]/table:opacity-10 group-data-[moving=true]/table:pointer-events-none";
              content = (
                <div className="w-full h-full flex items-center justify-center text-sm font-light tabular-nums">
                  -
                </div>
              );
            }
          }

          return (
            <div
              key={day.date}
              className={cellClasses}
              onClick={() => onCellClick(agent.id, day.date, hasShift)}
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.agent !== nextProps.agent) return false;
    if (prevProps.dStyles !== nextProps.dStyles) return false;
    if (prevProps.metrics !== nextProps.metrics) return false;
    if (prevProps.activeMove !== nextProps.activeMove) return false;
    if (prevProps.style.top !== nextProps.style.top) return false;
    return true;
  },
);
AgentRow.displayName = "AgentRow";
