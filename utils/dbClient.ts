// utils/dbClient.ts

class DbClient {
  worker: Worker | null = null;
  private messageIdCounter = 0;
  private callbacks = new Map<
    number,
    { resolve: Function; reject: Function }
  >();

  init() {
    // Prevent this from running on the Next.js SSR server
    if (typeof window === "undefined") return;

    // Prevent spawning multiple workers if React Strict Mode double-fires
    if (this.worker) return;

    console.log("Spawning SQLite Web Worker...");

    // Instantiate the Web Worker (Next.js handles the bundling automatically)
    this.worker = new Worker(
      new URL("../workers/db.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    // Listen for messages coming BACK from the worker
    this.worker.onmessage = (event) => {
      const { type, messageId, results, error } = event.data;

      if (type === "DB_READY") {
        console.log("🚀 Main Thread: Worker is online and DB is ready!");
      }

      if (type === "DB_ERROR") {
        console.error("Main Thread: Worker failed to initialize DB", error);
      }

      // Handle async query and batch responses
      if (type === "QUERY_SUCCESS" || type === "QUERY_ERROR") {
        const cb = this.callbacks.get(messageId);
        if (cb) {
          if (type === "QUERY_SUCCESS") cb.resolve(results);
          else cb.reject(error);
          this.callbacks.delete(messageId);
        }
      }
    };
  }

  // Execute a single SQL query
  async query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
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

  // Execute a massive batch of SQL queries in a single transaction
  async batch(queries: { sql: string; params?: any[] }[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error("Worker not initialized"));

      const messageId = ++this.messageIdCounter;
      this.callbacks.set(messageId, { resolve, reject });

      this.worker.postMessage({ type: "EXECUTE_BATCH", queries, messageId });
    });
  }
}

// Export a single, shared instance
export const dbClient = new DbClient();
