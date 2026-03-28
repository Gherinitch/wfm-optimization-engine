// utils/hydration.ts
import { dbClient } from "./dbClient";
import { Agent, Segment, Requirement } from "@/types/wfm";

export async function importWfmDataToSqlite(
  rawAgents: Record<string, Agent>,
  rawSegments: Record<string, Segment>,
  rawRequirements: Record<string, Requirement>,
) {
  console.log("⏳ Starting SQLite Hydration...");
  const queries: { sql: string; params?: any[] }[] = [];

  // 1. Wipe the current tables to prepare for a fresh eWFM import
  queries.push({ sql: "DELETE FROM segments;" });
  queries.push({ sql: "DELETE FROM shifts;" });
  queries.push({ sql: "DELETE FROM agents;" });
  queries.push({ sql: "DELETE FROM requirements;" });

  // 2. Insert Agents
  Object.values(rawAgents).forEach((agent) => {
    queries.push({
      sql: "INSERT INTO agents (id, name) VALUES (?, ?);",
      params: [agent.id, agent.name],
    });
  });

  // 3. Group flat segments into Shifts
  const segmentsByShift: Record<string, Segment[]> = {};

  Object.values(rawSegments).forEach((seg) => {
    if (seg.isGeneral) return;

    const shiftKey = `${seg.agentId}_${seg.date}`;
    if (!segmentsByShift[shiftKey]) {
      segmentsByShift[shiftKey] = [];
    }
    segmentsByShift[shiftKey].push(seg);
  });

  // 4. Insert Shifts and their Child Segments
  Object.entries(segmentsByShift).forEach(([shiftKey, segments]) => {
    const [agentId, date] = shiftKey.split("_");
    const shiftId = `shift_${agentId}_${date}`;

    queries.push({
      sql: "INSERT INTO shifts (id, agent_id, date) VALUES (?, ?, ?);",
      params: [shiftId, agentId, date],
    });

    segments.forEach((seg) => {
      queries.push({
        sql: `INSERT INTO segments (id, shift_id, category, name, start_min, end_min, rank) 
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
        params: [
          seg.id,
          shiftId,
          seg.category,
          seg.name,
          seg.startMin,
          seg.endMin,
          seg.rank || (seg.category === "Work" ? 1 : 2),
        ],
      });
    });
  });

  // 5. Insert Requirements (Fixed loop!)
  Object.entries(rawRequirements).forEach(([reqId, req]) => {
    queries.push({
      sql: `INSERT INTO requirements (id, date, interval_start_min, required_count) 
            VALUES (?, ?, ?, ?);`,
      params: [reqId, req.date, req.timeMin, req.req],
    });
  });

  // 6. Fire the batch
  const startTime = performance.now();
  await dbClient.batch(queries);
  const endTime = performance.now();

  console.log(
    `✅ Hydration Complete! Inserted ${queries.length} rows in ${Math.round(endTime - startTime)}ms.`,
  );
}

// 🚀 NEW: The Read-Back function!
export async function fetchDayFromSqlite(date: string) {
  console.log(`🔍 Fetching schedule for ${date} from SQLite...`);

  const [rawAgents, rawSegments, rawRequirements, rawEdits] = await Promise.all(
    [
      dbClient.query(`SELECT * FROM agents;`),
      dbClient.query(
        `SELECT segments.*, shifts.agent_id, shifts.date 
       FROM segments 
       JOIN shifts ON segments.shift_id = shifts.id 
       WHERE shifts.date = ?;`,
        [date],
      ),
      dbClient.query(`SELECT * FROM requirements WHERE date = ?;`, [date]),
      dbClient.query(`SELECT * FROM edits;`), // <-- Grabbing your edits!
    ],
  );

  const agents: Record<string, Agent> = {};
  const segments: Record<string, Segment> = {};
  const requirements: Record<string, Requirement> = {};

  rawAgents.forEach((row: any) => {
    agents[row.id] = { id: row.id, name: row.name, segments: [] };
  });

  rawSegments.forEach((row: any) => {
    segments[row.id] = {
      id: row.id,
      agentId: row.agent_id,
      name: row.name,
      category: row.category,
      isGeneral: false,
      isPaid:
        row.category === "Work" ||
        row.category === "Meeting" ||
        row.category === "Break",
      date: row.date,
      startMin: row.start_min,
      endMin: row.end_min,
      rank: row.rank,
    };

    if (agents[row.agent_id]) {
      agents[row.agent_id].segments.push(row.id);
    }
  });

  rawRequirements.forEach((row: any) => {
    requirements[row.id] = {
      date: row.date,
      timeMin: row.interval_start_min,
      req: row.required_count,
    };
  });

  // Parse the edits out of SQLite
  const edits = rawEdits.map((row: any) => {
    const oldD = row.old_data ? JSON.parse(row.old_data) : {};
    const newD = row.new_data ? JSON.parse(row.new_data) : {};
    return {
      id: row.id,
      segmentId: row.entity_id,
      segmentName: oldD.name || "Unknown",
      type: row.action,
      oldStartMin: oldD.start,
      oldEndMin: oldD.end,
      newStartMin: newD.start,
      newEndMin: newD.end,
      timestamp: row.timestamp,
    };
  });

  return { agents, segments, requirements, edits };
}
