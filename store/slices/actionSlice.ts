// store/slices/actionSlice.ts
import { StateCreator } from "zustand";
import { ScheduleState, ActionSlice } from "../storeTypes";
import { calculateNetEdits, runConstraintEngine } from "@/utils/engine";
import { dbClient, syncEditsToSqlite } from "@/utils/dbClient";

export const createActionSlice: StateCreator<
  ScheduleState,
  [],
  [],
  ActionSlice
> = (set, get) => ({
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
    dbClient
      .query(
        `UPDATE segments SET start_min = start_min + ?, end_min = end_min + ? WHERE shift_id = ?`,
        [offsetMins, offsetMins, `shift_${agentId}_${date}`],
      )
      .catch(console.error);
    syncEditsToSqlite(get().edits).catch(console.error);
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

    dbClient
      .batch([
        {
          sql: `UPDATE shifts SET agent_id = 'TEMP_SWAP' WHERE id = ?`,
          params: [`shift_${agentAId}_${date}`],
        },
        {
          sql: `UPDATE shifts SET agent_id = ? WHERE id = ?`,
          params: [agentAId, `shift_${agentBId}_${date}`],
        },
        {
          sql: `UPDATE shifts SET agent_id = ? WHERE id = ?`,
          params: [agentBId, `shift_${agentAId}_${date}`],
        },
      ])
      .catch(console.error);
    syncEditsToSqlite(get().edits).catch(console.error);
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

    dbClient
      .batch([
        {
          sql: `UPDATE shifts SET agent_id = 'TEMP_SWAP_1' WHERE id = ?`,
          params: [`shift_${agentAId}_${date}`],
        },
        {
          sql: `UPDATE shifts SET agent_id = ? WHERE id = ?`,
          params: [agentAId, `shift_${agentCId}_${date}`],
        },
        {
          sql: `UPDATE shifts SET agent_id = ? WHERE id = ?`,
          params: [agentCId, `shift_${agentBId}_${date}`],
        },
        {
          sql: `UPDATE shifts SET agent_id = ? WHERE id = ?`,
          params: [agentBId, `shift_${agentAId}_${date}`],
        },
      ])
      .catch(console.error);
    syncEditsToSqlite(get().edits).catch(console.error);
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

    dbClient
      .query(`UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`, [
        newStart,
        newEnd,
        id,
      ])
      .catch(console.error);
    syncEditsToSqlite(get().edits).catch(console.error);
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

        dbClient
          .query(
            `UPDATE segments SET start_min = start_min + ?, end_min = end_min + ? WHERE shift_id = ?`,
            [
              offsetMins,
              offsetMins,
              `shift_${segment.agentId}_${segment.date}`,
            ],
          )
          .catch(console.error);
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
        dbClient
          .query(
            `UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`,
            [newStart, newEnd, segmentId],
          )
          .catch(console.error);
      }

      return {
        segments: newSegmentsObj,
        edits: updatedEdits,
        pendingOverride: null,
      };
    });
    get().recalculateMetrics();
    syncEditsToSqlite(get().edits).catch(console.error);
  },

  revertEdit: (editId) => {
    set((state) => {
      const edit = state.edits.find((e) => e.id === editId);
      if (!edit) return state;
      const segment = state.segments[edit.segmentId];
      if (!segment) return state;

      dbClient
        .query(`UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`, [
          edit.oldStartMin,
          edit.oldEndMin,
          edit.segmentId,
        ])
        .catch(console.error);

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
    syncEditsToSqlite(get().edits).catch(console.error);
  },

  clearAllEdits: () => {
    set((state) => {
      const queries = Object.values(state.originalSegments).map((seg) => ({
        sql: `UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`,
        params: [seg.startMin, seg.endMin, seg.id],
      }));
      dbClient.batch(queries).catch(console.error);

      return {
        segments: JSON.parse(JSON.stringify(state.originalSegments)),
        edits: [],
      };
    });
    get().recalculateMetrics();
    syncEditsToSqlite(get().edits).catch(console.error);
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
          type: "DATE_CHANGE" as any, // We will cast this or update the types next
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
    dbClient
      .query(`UPDATE shifts SET date = ? WHERE agent_id = ? AND date = ?`, [
        newDate,
        agentId,
        oldDate,
      ])
      .catch(console.error);

    syncEditsToSqlite(get().edits).catch(console.error);
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
});
