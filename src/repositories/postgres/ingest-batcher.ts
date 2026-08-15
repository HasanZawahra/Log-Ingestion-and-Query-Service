import { pool } from "../../config/database.js";
import { MAX_LOGS_PER_INSERT } from "../../constants/log.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import {
  buildAggregateUpsert,
  buildLogsInsert,
  chunkLogEntries,
  groupEntriesForAggregation,
} from "./builders/log-bulk-insert-query.js";

export interface IngestBatcherOptions {
  targetFlushSize: number;
  maxConcurrentFlushes: number;
}

export const DEFAULT_INGEST_BATCHER_OPTIONS: IngestBatcherOptions = {
  targetFlushSize: MAX_LOGS_PER_INSERT,
  maxConcurrentFlushes: 5,
};

interface PendingBatch {
  entries: IngestLogEntry[];
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class IngestBatcher {
  private readonly queue: PendingBatch[] = [];
  private activeFlushes = 0;
  private readonly waiters = new Set<() => void>();
  private closed = false;

  constructor(private readonly options: IngestBatcherOptions = DEFAULT_INGEST_BATCHER_OPTIONS) {}

  save(entries: IngestLogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return Promise.resolve();
    }

    if (this.closed) {
      return Promise.reject(new Error("IngestBatcher is closed"));
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ entries, resolve, reject });
      this.wakeAll();
      this.spawnFlush();
    });
  }

  async flushPending(): Promise<void> {
    this.spawnFlush();

    while (this.queue.length > 0 || this.activeFlushes > 0) {
      this.wakeAll();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  close(): void {
    this.closed = true;
    this.wakeAll();
  }

  private wakeAll(): void {
    const waiters = Array.from(this.waiters);
    this.waiters.clear();

    for (const waiter of waiters) {
      waiter();
    }
  }

  private spawnFlush(): void {
    if (this.activeFlushes >= this.options.maxConcurrentFlushes || this.queue.length === 0) {
      return;
    }

    this.activeFlushes += 1;

    void this.runFlushLoop().finally(() => {
      this.activeFlushes -= 1;
      this.spawnFlush();
    });
  }

  private async runFlushLoop(): Promise<void> {
    while (this.queue.length > 0) {
      const batches = await this.waitForBatches();

      if (batches.length === 0) {
        break;
      }

      await this.persist(batches);
    }
  }

  private waitForBatches(): Promise<PendingBatch[]> {
    return new Promise((resolve) => {
      const finish = () => {
        this.waiters.delete(finish);
        resolve(this.takeBatches());
      };

      this.waiters.add(finish);
      queueMicrotask(finish);
    });
  }

  private takeBatches(): PendingBatch[] {
    const batches: PendingBatch[] = [];
    let count = 0;
    let index = 0;

    while (index < this.queue.length) {
      const next = this.queue[index] as PendingBatch;

      if (count > 0 && count + next.entries.length > this.options.targetFlushSize) {
        break;
      }

      batches.push(next);
      count += next.entries.length;
      index++;
    }

    if (index === 0 && this.queue.length > 0) {
      batches.push(this.queue[0] as PendingBatch);
      index = 1;
    }

    if (index > 0) {
      this.queue.splice(0, index);
    }

    return batches;
  }

  private async persist(batches: PendingBatch[]): Promise<void> {
    const entries = batches.flatMap((batch) => batch.entries);

    try {
      await persistEntries(entries);
      batches.forEach((batch) => batch.resolve());
    } catch (error) {
      batches.forEach((batch) => batch.reject(error));
    }
  }
}

export async function persistEntries(entries: IngestLogEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const client = await pool.connect();

  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.query("BEGIN");

        try {
          for (const chunk of chunkLogEntries(entries)) {
            const query = buildLogsInsert(chunk);
            await client.query(query.text, query.values);
          }

          const groups = groupEntriesForAggregation(entries);
          const aggregateQuery = buildAggregateUpsert(groups);
          await client.query(aggregateQuery.text, aggregateQuery.values);

          await client.query("COMMIT");
          return;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      } catch (error) {
        const isRetryable =
          attempt < 3 &&
          typeof error === "object" &&
          error !== null &&
          (error as { code?: string }).code === "40P01";

        if (!isRetryable) {
          throw error;
        }
      }
    }
  } finally {
    client.release();
  }
}
