// workers/db.worker.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let db: any;

// Initialize the SQLite Wasm module and OPFS
async function initDb() {
  try {
    const sqlite3 = await sqlite3InitModule();

    // FIXED: Check for OpfsDb directly and bypass the TS linter
    if ((sqlite3.oo1 as any).OpfsDb) {
      db = new (sqlite3.oo1 as any).OpfsDb("/wfm_optimization.sqlite3");
      console.log("✅ SQLite OPFS Database Initialized");
    } else {
      db = new sqlite3.oo1.DB("/wfm_optimization.sqlite3", "ct");
      console.warn("⚠️ OPFS not available, using volatile memory database.");
    }

    createSchema();
    self.postMessage({ type: "DB_READY" });
  } catch (err) {
    console.error("❌ Failed to initialize SQLite Wasm:", err);
    self.postMessage({ type: "DB_ERROR", error: err });
  }
}

function createSchema() {
  if (!db) return;

  // We wrap schema creation in a transaction for safety
  db.exec("BEGIN TRANSACTION;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'PUBLISHED',
      is_locked BOOLEAN DEFAULT 0,
      FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_shifts_agent ON shifts(agent_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      rank INTEGER DEFAULT 1,
      FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_segments_shift ON segments(shift_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      interval_start_min INTEGER NOT NULL,
      required_count REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_requirements_date ON requirements(date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      blueprint TEXT NOT NULL,
      target_category TEXT NOT NULL,
      reference_category TEXT,
      value_minutes INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY,
      entity_type TEXT,
      entity_id TEXT,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      timestamp INTEGER NOT NULL
    );
  `);

  db.exec("COMMIT;");
  console.log("✅ WFM Schema Verified");
}

// Listen for messages from the Zustand Store / React UI
self.onmessage = function (event) {
  const { type, query, params, messageId } = event.data;

  if (type === "EXECUTE_BATCH") {
    const { queries, messageId } = event.data;
    try {
      db.exec("BEGIN TRANSACTION;");
      // Loop through all queries and bind parameters securely
      for (const q of queries) {
        db.exec({ sql: q.sql, bind: q.params || [] });
      }
      db.exec("COMMIT;");
      self.postMessage({ type: "QUERY_SUCCESS", messageId, results: [] });
    } catch (err) {
      db.exec("ROLLBACK;"); // If one fails, they all fail safely!
      console.error("Batch Execution Error:", err);
      self.postMessage({ type: "QUERY_ERROR", messageId, error: err });
    }
  }

  if (type === "EXECUTE_QUERY") {
    try {
      const results: any[] = [];
      db.exec({
        sql: query,
        bind: params,
        rowMode: "object",
        callback: function (row: any) {
          results.push(row);
        },
      });
      self.postMessage({ type: "QUERY_SUCCESS", messageId, results });
    } catch (err) {
      console.error("SQL Execution Error:", err);
      self.postMessage({ type: "QUERY_ERROR", messageId, error: err });
    }
  }
};

// Start the database when the worker spawns
initDb();
