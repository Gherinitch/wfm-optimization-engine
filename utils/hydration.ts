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

// Add this to the bottom of utils/hydration.ts

export async function fetchDateRangeMetrics(
  startDate: string,
  endDate: string,
) {
  console.log(`🔍 Fetching weekly metrics from ${startDate} to ${endDate}...`);

  // 1. Get the total headcount so we know our absolute max capacity
  const totalAgentsRes = await dbClient.query(
    `SELECT COUNT(*) as count FROM agents`,
  );
  const totalAgents = totalAgentsRes[0]?.count || 0;

  const reqQuery = await dbClient.query(
    `
    SELECT date, SUM(required_count) / 4.0 as required_hours
    FROM requirements
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date;
  `,
    [startDate, endDate],
  );

  // 2. NEW: Advanced CTE Query to find shift-level metadata (Min shift length & Agent counts)
  const schedQuery = await dbClient.query(
    `
    WITH DailyAgentShifts AS (
      SELECT 
        s.date,
        s.agent_id,
        (SUM(CASE WHEN seg.category = 'Work' THEN (seg.end_min - seg.start_min) ELSE 0 END) -
         SUM(CASE WHEN seg.category IN ('Break', 'Lunch') THEN (seg.end_min - seg.start_min) ELSE 0 END)) / 60.0 AS shift_hours
      FROM shifts s
      JOIN segments seg ON s.id = seg.shift_id
      WHERE s.date BETWEEN ? AND ?
      GROUP BY s.date, s.agent_id
    )
    SELECT 
      date,
      SUM(shift_hours) as net_scheduled,
      COUNT(agent_id) as agents_scheduled,
      MIN(shift_hours) as min_shift_hours
    FROM DailyAgentShifts
    GROUP BY date
    ORDER BY date;
  `,
    [startDate, endDate],
  );

  let totalWeekRequired = 0;
  let totalWeekScheduled = 0;
  const dailyStats: Record<string, any> = {};

  reqQuery.forEach((row: any) => {
    dailyStats[row.date] = {
      date: row.date,
      required: row.required_hours || 0,
      scheduled: 0,
      agentsScheduled: 0,
      minShiftHours: 0,
    };
    totalWeekRequired += row.required_hours;
  });

  schedQuery.forEach((row: any) => {
    if (!dailyStats[row.date]) {
      dailyStats[row.date] = {
        date: row.date,
        required: 0,
        scheduled: 0,
        agentsScheduled: 0,
        minShiftHours: 0,
      };
    }
    dailyStats[row.date].scheduled = row.net_scheduled || 0;
    dailyStats[row.date].agentsScheduled = row.agents_scheduled || 0;
    dailyStats[row.date].minShiftHours = row.min_shift_hours || 0;
    totalWeekScheduled += row.net_scheduled || 0;
  });

  const weeklyAverageCoverage =
    totalWeekRequired > 0 ? totalWeekScheduled / totalWeekRequired : 1;

  const daysList = Object.values(dailyStats).map((day: any) => {
    const coverage = day.required > 0 ? day.scheduled / day.required : 1;
    const targetHours = day.required * weeklyAverageCoverage;
    const hoursToMove = targetHours - day.scheduled;

    const isWithinTolerance =
      Math.abs(coverage - weeklyAverageCoverage) <= 0.05;

    let status = "BALANCED";
    let isActionable = true;
    let unactionableReason = "";

    if (!isWithinTolerance) {
      if (coverage > weeklyAverageCoverage) {
        status = "OVERSTAFFED";

        // FEASIBILITY CHECK: Does removing the smallest available shift make things worse?
        // Math: If |Variance + MinShift| >= |Variance|, then moving it pushes us further from the goal.
        if (
          day.minShiftHours > 0 &&
          Math.abs(hoursToMove + day.minShiftHours) >= Math.abs(hoursToMove)
        ) {
          isActionable = false;
          unactionableReason = `Shortest shift is ${Math.round(day.minShiftHours)}h (Move worsens coverage)`;
        }
      } else {
        status = "UNDERSTAFFED";

        // FEASIBILITY CHECK: Are there any agents left to actually pull into this day?
        if (day.agentsScheduled >= totalAgents) {
          isActionable = false;
          unactionableReason = "All agents are already scheduled";
        }
      }
    }

    return {
      ...day,
      coveragePct: Math.round(coverage * 100),
      hoursToMove: Math.round(hoursToMove * 10) / 10,
      isWithinTolerance,
      status,
      isActionable,
      unactionableReason,
    };
  });

  return {
    days: daysList,
    weeklyAverageCoverage: Math.round(weeklyAverageCoverage * 100),
    totalWeekRequired: Math.round(totalWeekRequired),
    totalWeekScheduled: Math.round(totalWeekScheduled),
  };
}

// utils/hydration.ts (Add to bottom)

export async function fetchAgentsForReassignment(
  sourceDate: string,
  weekStart: string,
  weekEnd: string,
) {
  // 1. Find all agents working on the clicked day
  const agents = await dbClient.query(
    `
    SELECT DISTINCT a.id, a.name, s.id as shift_id
    FROM agents a
    JOIN shifts s ON a.id = s.agent_id
    WHERE s.date = ?
  `,
    [sourceDate],
  );

  if (agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id);
  const placeholders = agentIds.map(() => "?").join(",");

  // 2. Fetch the entire week's schedule for ONLY those agents
  const shifts = await dbClient.query(
    `
    SELECT s.agent_id, s.date, MIN(seg.start_min) as start_min, MAX(seg.end_min) as end_min
    FROM shifts s
    JOIN segments seg ON s.id = seg.shift_id
    WHERE s.agent_id IN (${placeholders})
      AND s.date BETWEEN ? AND ?
      AND seg.category = 'Work'
    GROUP BY s.id
  `,
    [...agentIds, weekStart, weekEnd],
  );

  // 3. Format it for the UI
  return agents.map((agent: any) => {
    const agentShifts = shifts.filter((s: any) => s.agent_id === agent.id);
    const scheduleMap: Record<string, { start: number; end: number }> = {};

    agentShifts.forEach((s: any) => {
      scheduleMap[s.date] = { start: s.start_min, end: s.end_min };
    });

    return {
      id: agent.id,
      name: agent.name,
      shiftId: agent.shift_id,
      schedule: scheduleMap,
    };
  });
}

export async function executeInterdayMove(
  agentId: string,
  oldDate: string,
  newDate: string,
) {
  // Execute the move entirely in SQLite so it works regardless of what day Zustand is currently viewing
  const shiftRes = await dbClient.query(
    `SELECT id FROM shifts WHERE agent_id = ? AND date = ?`,
    [agentId, oldDate],
  );
  if (!shiftRes.length) return;
  const shiftId = shiftRes[0].id;

  const segments = await dbClient.query(
    `SELECT * FROM segments WHERE shift_id = ?`,
    [shiftId],
  );
  const queries: { sql: string; params?: any[] }[] = [];

  // Update the parent shift date
  queries.push({
    sql: `UPDATE shifts SET date = ? WHERE id = ?`,
    params: [newDate, shiftId],
  });

  // Log it to the audit trail
  const timestamp = Date.now();
  segments.forEach((seg: any) => {
    queries.push({
      sql: `INSERT INTO edits (id, entity_type, entity_id, action, old_data, new_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        `edit_${timestamp}_${seg.id}`,
        "SEGMENT",
        seg.id,
        "DATE_CHANGE",
        JSON.stringify({
          name: seg.name,
          start: seg.start_min,
          end: seg.end_min,
          date: oldDate,
        }),
        JSON.stringify({
          start: seg.start_min,
          end: seg.end_min,
          date: newDate,
        }),
        timestamp,
      ],
    });
  });

  await dbClient.batch(queries);
}
// utils/hydration.ts (Add to bottom)

export async function fetchFullWeeklyGrid(startDate: string, endDate: string) {
  // 1. Get all agents
  const agentsRes = await dbClient.query(
    `SELECT id, name FROM agents ORDER BY name`,
  );

  // 2. Get all productive work shifts within the date range
  const shiftsRes = await dbClient.query(
    `
    SELECT s.agent_id, s.date, MIN(seg.start_min) as start_min, MAX(seg.end_min) as end_min
    FROM shifts s
    JOIN segments seg ON s.id = seg.shift_id
    WHERE s.date BETWEEN ? AND ? AND seg.category = 'Work'
    GROUP BY s.id
  `,
    [startDate, endDate],
  );

  // 3. Map the shifts onto the agents
  return agentsRes.map((agent) => {
    const schedule: Record<string, { start: number; end: number }> = {};
    shiftsRes
      .filter((s: any) => s.agent_id === agent.id)
      .forEach((s: any) => {
        schedule[s.date] = { start: s.start_min, end: s.end_min };
      });
    return { id: agent.id, name: agent.name, schedule };
  });
}
