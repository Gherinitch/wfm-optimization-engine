// store/slices/actionSlice.ts
import { StateCreator } from "zustand";
import { ScheduleState, ActionSlice } from "../storeTypes";
import {
  calculateNetEdits,
  runConstraintEngine,
  runIntradayOptimization,
} from "@/utils/engine";
import { logger } from "@/utils/logger";
import {
  syncEditsToSqlite,
  syncSegmentOffsetToSqlite,
  syncShiftSwapToSqlite,
  syncThreeWaySwapToSqlite,
  syncSegmentUpdateToSqlite,
  syncShiftMoveToDateToSqlite,
  syncSegmentsStateToSqlite,
} from "@/utils/dbClient";

export const createActionSlice: StateCreator<
  ScheduleState,
  [],
  [],
  ActionSlice
> = (setOriginal, get) => {
  const set = (
    updater: (state: ScheduleState) => Partial<ScheduleState> | void,
  ) => {
    setOriginal((state: ScheduleState) => {
      const updates = typeof updater === "function" ? updater(state) : updater;
      if (!updates) return state;

      // Save history block if segments or agents change
      if (updates.segments || updates.agents) {
        return {
          ...updates,
          pastStates: [
            ...state.pastStates.slice(-14),
            {
              segments: state.segments,
              agents: state.agents,
              edits: state.edits,
            },
          ],
          futureStates: [],
        };
      }
      return updates;
    });
  };

  return {
    shiftAgentDay: (agentId, date, offsetMins) => {
      set((state) => {
        const agent = state.agents[agentId];
        if (!agent) return state;

        const segmentsToMove = agent.segments.filter(
          (id) => state.segments[id]?.date === date,
        );
        if (segmentsToMove.length === 0) return state;

        const newSegmentsObj = { ...state.segments };
        let updatedEdits = [...state.edits];

        segmentsToMove.forEach((id) => {
          const seg = newSegmentsObj[id];
          const newStart = seg.startMin + offsetMins;
          const newEnd = seg.endMin + offsetMins;

          newSegmentsObj[id] = { ...seg, startMin: newStart, endMin: newEnd };

          if (offsetMins !== 0) {
            updatedEdits = calculateNetEdits(
              updatedEdits,
              id,
              seg.name,
              seg.startMin,
              seg.endMin,
              newStart,
              newEnd,
            );
          }
        });

        return { segments: newSegmentsObj, edits: updatedEdits };
      });
      get().recalculateMetrics();

      // Optimistic Database Sync
      syncSegmentOffsetToSqlite(agentId, date, offsetMins).catch((error) =>
        logger.error("Failed to shift agent day", error),
      );
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    executeShiftSwap: (agentAId, agentBId, date) => {
      set((state) => {
        const agentA = state.agents[agentAId];
        const agentB = state.agents[agentBId];
        if (!agentA || !agentB) return state;

        const aSegments = agentA.segments.filter(
          (id) => state.segments[id]?.date === date,
        );
        const bSegments = agentB.segments.filter(
          (id) => state.segments[id]?.date === date,
        );

        const newSegmentsObj = { ...state.segments };
        const newEdits = [...state.edits];

        const swapAssign = (segIds: string[], targetAgentId: string) => {
          segIds.forEach((id) => {
            newSegmentsObj[id] = {
              ...newSegmentsObj[id],
              agentId: targetAgentId,
            };
            newEdits.unshift({
              id: `edit_${Date.now()}_${id}`,
              segmentId: id,
              segmentName: newSegmentsObj[id].name,
              type: "REASSIGNMENT",
              oldStartMin: newSegmentsObj[id].startMin,
              newStartMin: newSegmentsObj[id].startMin,
              oldEndMin: newSegmentsObj[id].endMin,
              newEndMin: newSegmentsObj[id].endMin,
              timestamp: Date.now(),
            });
          });
        };

        swapAssign(aSegments, agentBId);
        swapAssign(bSegments, agentAId);

        return {
          segments: newSegmentsObj,
          edits: newEdits,
          agents: {
            ...state.agents,
            [agentAId]: {
              ...agentA,
              segments: [
                ...agentA.segments.filter((id) => !aSegments.includes(id)),
                ...bSegments,
              ],
            },
            [agentBId]: {
              ...agentB,
              segments: [
                ...agentB.segments.filter((id) => !bSegments.includes(id)),
                ...aSegments,
              ],
            },
          },
          pendingSwap: null,
        };
      });
      get().recalculateMetrics();

      syncShiftSwapToSqlite(agentAId, agentBId, date).catch((error) =>
        logger.error("Failed to execute shift swap", error),
      );
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    executeThreeWaySwap: (agentAId, agentBId, agentCId, date) => {
      set((state) => {
        const agentA = state.agents[agentAId],
          agentB = state.agents[agentBId],
          agentC = state.agents[agentCId];
        if (!agentA || !agentB || !agentC) return state;

        const aSegments = agentA.segments.filter(
          (id) => state.segments[id]?.date === date,
        );
        const bSegments = agentB.segments.filter(
          (id) => state.segments[id]?.date === date,
        );
        const cSegments = agentC.segments.filter(
          (id) => state.segments[id]?.date === date,
        );

        const newSegmentsObj = { ...state.segments };
        const newEdits = [...state.edits];

        const reassign = (segIds: string[], newAgentId: string) => {
          segIds.forEach((id) => {
            newSegmentsObj[id] = { ...newSegmentsObj[id], agentId: newAgentId };
            newEdits.unshift({
              id: `edit_${Date.now()}_${id}_${Math.random().toString(36).substr(2, 5)}`,
              segmentId: id,
              segmentName: newSegmentsObj[id].name,
              type: "REASSIGNMENT",
              oldStartMin: newSegmentsObj[id].startMin,
              newStartMin: newSegmentsObj[id].startMin,
              oldEndMin: newSegmentsObj[id].endMin,
              newEndMin: newSegmentsObj[id].endMin,
              timestamp: Date.now(),
            });
          });
        };

        reassign(aSegments, agentBId);
        reassign(bSegments, agentCId);
        reassign(cSegments, agentAId);

        return {
          segments: newSegmentsObj,
          edits: newEdits,
          pendingSwap: null,
          agents: {
            ...state.agents,
            [agentAId]: {
              ...agentA,
              segments: [
                ...agentA.segments.filter((id) => !aSegments.includes(id)),
                ...cSegments,
              ],
            },
            [agentBId]: {
              ...agentB,
              segments: [
                ...agentB.segments.filter((id) => !bSegments.includes(id)),
                ...aSegments,
              ],
            },
            [agentCId]: {
              ...agentC,
              segments: [
                ...agentC.segments.filter((id) => !cSegments.includes(id)),
                ...bSegments,
              ],
            },
          },
        };
      });
      get().recalculateMetrics();

      syncThreeWaySwapToSqlite(agentAId, agentBId, agentCId, date).catch(
        (error) => logger.error("Failed to execute three-way swap", error),
      );
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    updateSegmentTime: (id, newStart, newEnd) => {
      set((state) => {
        const segment = state.segments[id];
        if (!segment) return state;
        const newEdits = calculateNetEdits(
          state.edits,
          id,
          segment.name,
          segment.startMin,
          segment.endMin,
          newStart,
          newEnd,
        );
        return {
          segments: {
            ...state.segments,
            [id]: { ...segment, startMin: newStart, endMin: newEnd },
          },
          edits: newEdits,
        };
      });
      get().recalculateMetrics();

      syncSegmentUpdateToSqlite(id, newStart, newEnd).catch((error) =>
        logger.error("Failed to update segment time", error),
      );
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    assignSegmentToAgent: (segmentId, newAgentId) => {
      set((state) => {
        const segment = state.segments[segmentId];
        if (!segment || segment.agentId === newAgentId) return state;
        const oldAgentId = segment.agentId;
        return {
          agents: {
            ...state.agents,
            [oldAgentId]: {
              ...state.agents[oldAgentId],
              segments: state.agents[oldAgentId].segments.filter(
                (id) => id !== segmentId,
              ),
            },
            [newAgentId]: {
              ...state.agents[newAgentId],
              segments: [...state.agents[newAgentId].segments, segmentId],
            },
          },
          segments: {
            ...state.segments,
            [segmentId]: { ...segment, agentId: newAgentId },
          },
        };
      });
      get().recalculateMetrics();
    },

    confirmPendingOverride: () => {
      set((state) => {
        if (!state.pendingOverride) return state;
        const { segmentId, newStart, newEnd } = state.pendingOverride;
        const segment = state.segments[segmentId];
        if (!segment) return { pendingOverride: null };

        const newSegmentsObj = { ...state.segments };
        let updatedEdits = [...state.edits];

        if (segment.category === "Work") {
          const offsetMins = newStart - segment.startMin;
          const agent = state.agents[segment.agentId];
          const segmentsToMove = agent.segments.filter(
            (id) => state.segments[id]?.date === segment.date,
          );

          segmentsToMove.forEach((id) => {
            const seg = newSegmentsObj[id];
            const sStart = seg.startMin + offsetMins;
            const sEnd = seg.endMin + offsetMins;
            newSegmentsObj[id] = { ...seg, startMin: sStart, endMin: sEnd };

            if (offsetMins !== 0) {
              updatedEdits = calculateNetEdits(
                updatedEdits,
                id,
                seg.name,
                seg.startMin,
                seg.endMin,
                sStart,
                sEnd,
              );
            }
          });

          syncSegmentOffsetToSqlite(
            segment.agentId,
            segment.date,
            offsetMins,
          ).catch((error) => logger.error("Failed to offset segments", error));
        } else {
          newSegmentsObj[segmentId] = {
            ...segment,
            startMin: newStart,
            endMin: newEnd,
          };
          if (newStart !== segment.startMin || newEnd !== segment.endMin) {
            updatedEdits = calculateNetEdits(
              updatedEdits,
              segmentId,
              segment.name,
              segment.startMin,
              segment.endMin,
              newStart,
              newEnd,
            );
          }
          syncSegmentUpdateToSqlite(segmentId, newStart, newEnd).catch(
            (error) => logger.error("Failed to update segment time", error),
          );
        }

        return {
          segments: newSegmentsObj,
          edits: updatedEdits,
          pendingOverride: null,
        };
      });
      get().recalculateMetrics();
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    revertEdit: (editId) => {
      set((state) => {
        const edit = state.edits.find((e) => e.id === editId);
        if (!edit) return state;
        const segment = state.segments[edit.segmentId];
        if (!segment) return state;

        syncSegmentUpdateToSqlite(
          edit.segmentId,
          edit.oldStartMin,
          edit.oldEndMin,
        ).catch((error) => logger.error("Failed to revert edit", error));

        return {
          segments: {
            ...state.segments,
            [edit.segmentId]: {
              ...segment,
              startMin: edit.oldStartMin,
              endMin: edit.oldEndMin,
            },
          },
          edits: state.edits.filter((e) => e.id !== editId),
        };
      });
      get().recalculateMetrics();
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    clearAllEdits: () => {
      set((state) => {
        syncSegmentsStateToSqlite(state.originalSegments).catch((error) =>
          logger.error("Failed to clear all edits", error),
        );

        return {
          segments: JSON.parse(JSON.stringify(state.originalSegments)),
          edits: [],
        };
      });
      get().recalculateMetrics();
      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    moveShiftToDate: (agentId, oldDate, newDate) => {
      set((state) => {
        const newSegmentsObj = { ...state.segments };
        const agent = state.agents[agentId];
        if (!agent) return state;

        // Find all segments this agent is working on the old date
        const segmentsToMove = agent.segments.filter(
          (id) => state.segments[id]?.date === oldDate,
        );
        if (segmentsToMove.length === 0) return state;

        const newEdits = [...state.edits];

        // Update their dates and log the edit
        segmentsToMove.forEach((id) => {
          newSegmentsObj[id] = { ...newSegmentsObj[id], date: newDate };

          newEdits.unshift({
            id: `edit_${Date.now()}_${id}_date_shift`,
            segmentId: id,
            segmentName: newSegmentsObj[id].name,
            type: "DATE_CHANGE",
            oldStartMin: newSegmentsObj[id].startMin,
            newStartMin: newSegmentsObj[id].startMin,
            oldEndMin: newSegmentsObj[id].endMin, // FIXED: Removed the extra 'End'
            newEndMin: newSegmentsObj[id].endMin,
            timestamp: Date.now(),
          });
        });

        return { segments: newSegmentsObj, edits: newEdits };
      });

      get().recalculateMetrics();

      // 🚀 Optimistic Background Sync: Update the parent shift's date!
      syncShiftMoveToDateToSqlite(agentId, oldDate, newDate).catch((error) =>
        logger.error("Failed to move shift to date", error),
      );

      syncEditsToSqlite(get().edits).catch((error) =>
        logger.error("Failed to sync edits to SQLite", error),
      );
    },

    getSegmentViolations: (segmentId) => {
      const state = get();
      const segment = state.segments[segmentId];
      if (!segment) return [];
      return runConstraintEngine(
        segmentId,
        segment.startMin,
        segment.endMin,
        state.segments,
        state.agents,
        state.rules,
      );
    },

    checkHypotheticalViolations: (segmentId, newStartMin, newEndMin) => {
      const state = get();
      return runConstraintEngine(
        segmentId,
        newStartMin,
        newEndMin,
        state.segments,
        state.agents,
        state.rules,
      );
    },

    runIntradayOptimization: async (date) => {
      const state = get();
      state.setIsOptimizing(true);
      state.setOptimizationProgress(0);

      // Yield back to the event loop so the UI updates
      await new Promise((r) => setTimeout(r, 10));

      try {
        const moves = await runIntradayOptimization(
          date,
          state.segments,
          state.agents,
          state.requirements,
          state.rules,
          (progress) => get().setOptimizationProgress(progress),
        );

        if (moves.length === 0) {
          alert("Schedule is optimal or constrained.");
          return;
        }
        get().setPendingIntradayOptimization({ date, moves });
      } finally {
        get().setIsOptimizing(false);
        get().setOptimizationProgress(0);
      }
    },

    confirmIntradayOptimization: (moves) => {
      setOriginal((state: ScheduleState) => {
        const newSegments = { ...state.segments };
        let newEdits = [...state.edits];
        moves.forEach((m) => {
          const seg = newSegments[m.segmentId];
          newSegments[m.segmentId] = {
            ...seg,
            startMin: m.newStart,
            endMin: m.newEnd,
          };
          newEdits = calculateNetEdits(
            newEdits,
            m.segmentId,
            seg.name,
            seg.startMin,
            seg.endMin,
            m.newStart,
            m.newEnd,
          );
          syncSegmentUpdateToSqlite(m.segmentId, m.newStart, m.newEnd).catch(
            (err) =>
              logger.error("Failed to sync segment update to SQLite", err),
          );
        });
        syncEditsToSqlite(newEdits);

        return {
          segments: newSegments,
          edits: newEdits,
          pendingIntradayOptimization: null,
          pastStates: [
            ...state.pastStates.slice(-14),
            {
              segments: state.segments,
              agents: state.agents,
              edits: state.edits,
            },
          ],
          futureStates: [],
        };
      });
      get().recalculateMetrics();
    },

    undo: () => {
      const state = get();
      if (state.pastStates.length === 0) return;
      const previous = state.pastStates[state.pastStates.length - 1];
      const newPast = state.pastStates.slice(0, -1);

      const current = {
        segments: state.segments,
        agents: state.agents,
        edits: state.edits,
      };

      syncSegmentsStateToSqlite(previous.segments).catch((error) =>
        logger.error("Failed to undo: restore segments", error),
      );
      syncEditsToSqlite(previous.edits).catch((error) =>
        logger.error("Failed to undo: restore edits", error),
      );

      setOriginal({
        segments: previous.segments,
        agents: previous.agents,
        edits: previous.edits,
        pastStates: newPast,
        futureStates: [current, ...state.futureStates],
      } as Partial<ScheduleState>);

      setTimeout(() => get().recalculateMetrics(), 10);
    },

    redo: () => {
      const state = get();
      if (state.futureStates.length === 0) return;
      const next = state.futureStates[0];
      const newFuture = state.futureStates.slice(1);

      const current = {
        segments: state.segments,
        agents: state.agents,
        edits: state.edits,
      };

      syncSegmentsStateToSqlite(next.segments).catch((error) =>
        logger.error("Failed to redo: restore segments", error),
      );
      syncEditsToSqlite(next.edits).catch((error) =>
        logger.error("Failed to redo: restore edits", error),
      );

      setOriginal({
        segments: next.segments,
        agents: next.agents,
        edits: next.edits,
        pastStates: [...state.pastStates, current],
        futureStates: newFuture,
      } as Partial<ScheduleState>);

      setTimeout(() => get().recalculateMetrics(), 10);
    },
  };
};
