import re

with open('store/slices/actionSlice.ts', 'r') as f:
    text = f.read()

# 1. Add runIntradayOptimization import
text = text.replace(
    'import { calculateNetEdits, runConstraintEngine } from "@/utils/engine";',
    'import { calculateNetEdits, runConstraintEngine, runIntradayOptimization } from "@/utils/engine";'
)

# 2. Add the set(updater) wrapper
head = """export const createActionSlice: StateCreator<
  ScheduleState,
  [],
  [],
  ActionSlice
> = (setOriginal, get) => {
  const set = (updater: (state: ScheduleState) => Partial<ScheduleState> | void | any) => {
    setOriginal((state: ScheduleState) => {
      const updates = typeof updater === "function" ? updater(state) : updater;
      if (!updates) return state;
      
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

  return {"""

text = re.sub(
    r'export const createActionSlice: StateCreator<[\s\S]*?> = \(set, get\) => \(\{',
    head,
    text
)

# 3. Append the end functions
tail = """  checkHypotheticalViolations: (segmentId, newStartMin, newEndMin) => {
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

  runIntradayOptimization: (date) => {
    setOriginal((state: ScheduleState) => {
      const moves = runIntradayOptimization(
        date,
        state.segments,
        state.agents,
        state.requirements,
        state.rules
      );
      if (moves.length === 0) {
        alert("Schedule is optimal or constrained.");
        return state;
      }
      
      const newSegmentsObj = { ...state.segments };
      let newEdits = [...state.edits];
      
      moves.forEach((m) => {
        const seg = newSegmentsObj[m.segmentId];
        newSegmentsObj[m.segmentId] = { ...seg, startMin: m.newStart, endMin: m.newEnd };
        newEdits = calculateNetEdits(
          newEdits,
          m.segmentId,
          seg.name,
          seg.startMin,
          seg.endMin,
          m.newStart,
          m.newEnd
        );
        dbClient
          .query(`UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`, [
            m.newStart,
            m.newEnd,
            m.segmentId,
          ])
          .catch(console.error);
      });
      syncEditsToSqlite(newEdits).catch(console.error);
      
      return { 
        segments: newSegmentsObj, 
        edits: newEdits,
        pastStates: [
          ...state.pastStates.slice(-14),
          { segments: state.segments, agents: state.agents, edits: state.edits },
        ],
        futureStates: []
      };
    });
    get().recalculateMetrics();
  },

  undo: () => {
    const state = get();
    if (state.pastStates.length === 0) return;
    const previous = state.pastStates[state.pastStates.length - 1];
    const newPast = state.pastStates.slice(0, -1);
    
    const current = { segments: state.segments, agents: state.agents, edits: state.edits };
    
    const queries = Object.values(previous.segments).map((seg) => ({
      sql: 'UPDATE segments SET start_min = ?, end_min = ?, agent_id = ?, date = ? WHERE id = ?',
      params: [seg.startMin, seg.endMin, seg.agentId, seg.date, seg.id],
    }));
    dbClient.batch(queries).catch(console.error);
    syncEditsToSqlite(previous.edits);
    
    setOriginal({
      segments: previous.segments,
      agents: previous.agents,
      edits: previous.edits,
      pastStates: newPast,
      futureStates: [current, ...state.futureStates],
    });
    get().recalculateMetrics();
  },

  redo: () => {
    const state = get();
    if (state.futureStates.length === 0) return;
    const next = state.futureStates[0];
    const newFuture = state.futureStates.slice(1);
    
    const current = { segments: state.segments, agents: state.agents, edits: state.edits };

    const queries = Object.values(next.segments).map((seg) => ({
      sql: 'UPDATE segments SET start_min = ?, end_min = ?, agent_id = ?, date = ? WHERE id = ?',
      params: [seg.startMin, seg.endMin, seg.agentId, seg.date, seg.id],
    }));
    dbClient.batch(queries).catch(console.error);
    syncEditsToSqlite(next.edits);
    
    setOriginal({
      segments: next.segments,
      agents: next.agents,
      edits: next.edits,
      pastStates: [...state.pastStates, current],
      futureStates: newFuture,
    });
    get().recalculateMetrics();
  },
};
};
"""

text = re.sub(
    r'  checkHypotheticalViolations: \(segmentId, newStartMin, newEndMin\) => \{[\s\S]*?\}\);\n\}',
    tail,
    text
)

# wait the original ends with `  },\n});` not `});\n}`
text = re.sub(
    r'  checkHypotheticalViolations: \(segmentId, newStartMin, newEndMin\) => \{[\s\S]*?\}\);\n  \},\n\}\);',
    tail,
    text
)

with open('store/slices/actionSlice.ts', 'w') as f:
    f.write(text)
