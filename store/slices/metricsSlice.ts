// store/slices/metricsSlice.ts
import { StateCreator } from "zustand";
import { ScheduleState, MetricsSlice } from "../storeTypes";
import { MINS_PER_DAY, MINS_PER_INTERVAL } from "@/constants/wfm";

export const createMetricsSlice: StateCreator<
  ScheduleState,
  [],
  [],
  MetricsSlice
> = (set, get) => ({
  dailyCoverage: new Array(MINS_PER_DAY).fill(0),
  dailyScheduledMetrics: 0,
  dailyRequiredMetrics: 0,

  recalculateMetrics: () =>
    set((state) => {
      const coverage = new Array(MINS_PER_DAY).fill(0);

      Object.values(state.agents).forEach((agent) => {
        const todaysSegs = agent.segments
          .map((id) => state.segments[id])
          .filter(
            (seg) => seg && seg.date === state.selectedDate && !seg.isGeneral,
          );

        const agentMins = new Array(MINS_PER_DAY).fill(0);

        todaysSegs.forEach((seg) => {
          const start = Math.max(0, seg.startMin);
          const end = Math.min(MINS_PER_DAY, seg.endMin);

          if (seg.category === "Work") {
            for (let m = start; m < end; m++)
              if (agentMins[m] !== -1) agentMins[m] = 1;
          } else {
            for (let m = start; m < end; m++) agentMins[m] = -1;
          }
        });

        for (let m = 0; m < MINS_PER_DAY; m++) {
          if (agentMins[m] === 1) coverage[m]++;
        }
      });

      const totalProductiveMinutes = coverage.reduce(
        (acc, val) => acc + val,
        0,
      );
      let dailyRequired = 0;
      Object.values(state.requirements).forEach((r) => {
        if (r.date === state.selectedDate) dailyRequired += r.req;
      });

      return {
        dailyCoverage: coverage,
        dailyScheduledMetrics: totalProductiveMinutes / MINS_PER_INTERVAL,
        dailyRequiredMetrics: dailyRequired,
      };
    }),

  getDailyMetrics: () => {
    const state = get();
    return {
      dailyScheduled: state.dailyScheduledMetrics,
      dailyRequired: state.dailyRequiredMetrics,
    };
  },

  getAggregatedMetrics: (startMin, durationMins) => {
    const state = get();
    const intervals = Math.max(1, durationMins / MINS_PER_INTERVAL);
    let totalScheduled = 0,
      totalRequired = 0;

    for (let i = 0; i < intervals; i++) {
      const t = startMin + i * MINS_PER_INTERVAL;
      totalScheduled += state.dailyCoverage[t] || 0;
      totalRequired +=
        state.requirements[`${state.selectedDate}_${t}`]?.req || 0;
    }

    const avgScheduled = totalScheduled / intervals;
    const avgRequired = totalRequired / intervals;
    const dailyRatio =
      state.dailyRequiredMetrics > 0
        ? state.dailyScheduledMetrics / state.dailyRequiredMetrics
        : 1;
    const gst =
      avgRequired > 0 && state.dailyRequiredMetrics > 0
        ? avgScheduled / avgRequired / dailyRatio
        : 1;

    const GST_TARGET = 0.7;
    const targetAvgScheduled = GST_TARGET * avgRequired * dailyRatio;
    const varianceMins = Math.round(
      (avgScheduled - targetAvgScheduled) * durationMins,
    );

    return {
      scheduled: avgScheduled,
      required: avgRequired,
      gst,
      varianceMins,
    };
  },
});
