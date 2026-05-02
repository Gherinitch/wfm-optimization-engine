// utils/dbClient.ts
import { EditRecord, DbQueryParams } from "@/types/wfm";
import { logger } from "@/utils/logger";

class DbClient {
  worker: Worker | null = null;
  private messageIdCounter = 0;
  private callbacks = new Map<
    number,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    { resolve: Function; reject: Function }
  >();

  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private onMessageHandler: ((event: MessageEvent) => void) | null = null;

  init() {
    if (typeof window === "undefined") return;

    if (this.worker) return this.readyPromise;

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    logger.info("Spawning SQLite Web Worker...");

    this.worker = new Worker(
      new URL("../workers/db.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    this.onMessageHandler = (event) => {
      const { type, messageId, results, error } = event.data;

      if (type === "DB_READY") {
        logger.info("Main Thread: Worker is online and DB is ready!");
        if (this.resolveReady) this.resolveReady();
      }

      if (type === "DB_ERROR") {
        logger.error("Main Thread: Worker failed to initialize DB", error);
      }

      if (type === "QUERY_SUCCESS" || type === "QUERY_ERROR") {
        const cb = this.callbacks.get(messageId);
        if (cb) {
          if (type === "QUERY_SUCCESS") cb.resolve(results);
          else cb.reject(error);
          this.callbacks.delete(messageId);
        }
      }
    };

    this.worker.onmessage = this.onMessageHandler;

    return this.readyPromise;
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: DbQueryParams = [],
  ): Promise<T[]> {
    if (this.readyPromise) await this.readyPromise;

    return new Promise<T[]>((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error("Database Worker is not initialized"));
      }

      const messageId = ++this.messageIdCounter;
      this.callbacks.set(messageId, { resolve, reject });

      this.worker.postMessage({
        type: "EXECUTE_QUERY",
        query: sql,
        params,
        messageId,
      });
    });
  }

  async batch(
    queries: { sql: string; params?: DbQueryParams }[],
  ): Promise<void> {
    if (this.readyPromise) await this.readyPromise;

    return new Promise<void>((resolve, reject) => {
      if (!this.worker) return reject(new Error("Worker not initialized"));

      const messageId = ++this.messageIdCounter;
      this.callbacks.set(messageId, { resolve, reject });

      this.worker.postMessage({ type: "EXECUTE_BATCH", queries, messageId });
    });
  }

  cleanup() {
    if (this.onMessageHandler && this.worker) {
      this.worker.removeEventListener("message", this.onMessageHandler);
      this.onMessageHandler = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.callbacks.clear();
    this.readyPromise = null;
    this.resolveReady = null;
  }
}

export const dbClient = new DbClient();

// 🚀 Helper to sync the entire audit log to the database
export const syncEditsToSqlite = async (edits: EditRecord[]) => {
  // FIXED: Explicitly type the array so TypeScript knows `params` is allowed!
  const queries: { sql: string; params?: DbQueryParams }[] = [
    { sql: "DELETE FROM edits;" },
  ];

  edits.forEach((e) => {
    queries.push({
      sql: `INSERT INTO edits (id, entity_type, entity_id, action, old_data, new_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        e.id,
        "SEGMENT",
        e.segmentId,
        e.type,
        JSON.stringify({
          name: e.segmentName,
          start: e.oldStartMin,
          end: e.oldEndMin,
        }),
        JSON.stringify({ start: e.newStartMin, end: e.newEndMin }),
        e.timestamp,
      ],
    });
  });

  return dbClient.batch(queries);
};

// --- Action Sync Helpers ---

export const syncSegmentOffsetToSqlite = async (
  agentId: string,
  date: string,
  offsetMins: number,
) => {
  return dbClient.query(
    `UPDATE segments SET start_min = start_min + ?, end_min = end_min + ? WHERE shift_id = ?`,
    [offsetMins, offsetMins, `shift_${agentId}_${date}`],
  );
};

export const syncShiftSwapToSqlite = async (
  agentAId: string,
  agentBId: string,
  date: string,
) => {
  return dbClient.batch([
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
  ]);
};

export const syncThreeWaySwapToSqlite = async (
  agentAId: string,
  agentBId: string,
  agentCId: string,
  date: string,
) => {
  return dbClient.batch([
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
  ]);
};

export const syncSegmentUpdateToSqlite = async (
  segmentId: string,
  newStart: number,
  newEnd: number,
) => {
  return dbClient.query(
    `UPDATE segments SET start_min = ?, end_min = ? WHERE id = ?`,
    [newStart, newEnd, segmentId],
  );
};

export const syncShiftMoveToDateToSqlite = async (
  agentId: string,
  oldDate: string,
  newDate: string,
) => {
  return dbClient.query(
    `UPDATE shifts SET date = ? WHERE agent_id = ? AND date = ?`,
    [newDate, agentId, oldDate],
  );
};

export const syncSegmentsStateToSqlite = async (
  segments: Record<
    string,
    {
      id: string;
      startMin: number;
      endMin: number;
      agentId: string;
      date: string;
    }
  >,
) => {
  const queries = Object.values(segments).map((seg) => ({
    sql: "UPDATE segments SET start_min = ?, end_min = ?, agent_id = ?, date = ? WHERE id = ?",
    params: [seg.startMin, seg.endMin, seg.agentId, seg.date, seg.id],
  }));
  return dbClient.batch(queries);
};
