// utils/hydration.ts
import { dbClient } from "./dbClient";
import { Agent, Segment, Requirement } from "@/types/wfm";

export async function importWfmDataToSqlite(
  rawAgents: Record<string, Agent>,
  rawSegments: Record<string, Segment>,
  rawRequirements: Record<string, Requirement>,
) {
  console.log("⏳ Starting SQLite Hydration...");
  const queries: { sql: string; params: any[] }[] = [];

  // 1. Wipe the current tables to prepare for a fresh eWFM import
  queries.push({ sql: "DELETE FROM segments;", params: [] });
  queries.push({ sql: "DELETE FROM shifts;", params: [] });
  queries.push({ sql: "DELETE FROM agents;", params: [] });
  queries.push({ sql: "DELETE FROM requirements;", params: [] });

  // 2. Insert Agents
  Object.values(rawAgents).forEach((agent) => {
    queries.push({
      sql: "INSERT INTO agents (id, name) VALUES (?, ?);",
      params: [agent.id, agent.name],
    });
  });

  // 3. Group flat segments into Shifts
  // A Shift is uniquely identified by an Agent working on a specific Date
  const segmentsByShift: Record<string, Segment[]> = {};

  Object.values(rawSegments).forEach((seg) => {
    if (seg.isGeneral) return; // Skip general bucket items if any

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

    // Create the Parent Shift
    queries.push({
      sql: "INSERT INTO shifts (id, agent_id, date) VALUES (?, ?, ?);",
      params: [shiftId, agentId, date],
    });

    // Create the Child Segments and link them to the Parent
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
          seg.rank || (seg.category === "Work" ? 1 : 2), // Ensure Work is layered on the bottom
        ],
      });
    });
  });

  // 5. Insert Requirements (The GST Curve)
  Object.values(rawRequirements).forEach((req) => {
    // Assuming req.id looks like "2026-03-30_480"
    const [date, minStr] = req.id.split("_");
    queries.push({
      sql: `INSERT INTO requirements (id, date, interval_start_min, required_count) 
            VALUES (?, ?, ?, ?);`,
      params: [req.id, date, parseInt(minStr), req.req],
    });
  });

  // 6. Fire the massive batch transaction to SQLite!
  const startTime = performance.now();
  await dbClient.batch(queries);
  const endTime = performance.now();

  console.log(
    `✅ Hydration Complete! Inserted ${queries.length} rows in ${Math.round(endTime - startTime)}ms.`,
  );
}
