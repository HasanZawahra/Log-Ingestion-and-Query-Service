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
  flushIntervalMs: number;
  maxConcurrentFlushes: number;
}

export const DEFAULT_INGEST_BATCHER_OPTIONS: IngestBatcherOptions = {
  targetFlushSize: MAX_LOGS_PER_INSERT * 2,
  flushIntervalMs: 20,
  maxConcurrentFlushes: 2,
};

interface PendingBatch {
  entries: IngestLogEntry[];
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class IngestBatcher {
  private readonly queue: PendingBatch[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private activeFlushes = 0;
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
      this.scheduleFlush();
    });
  }

  async flushPending(): Promise<void> {
    this.spawnFlush();

    while (this.queue.length > 0 || this.activeFlushes > 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  close(): void {
    this.closed = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private scheduleFlush(): void {
    const queuedCount = this.queue.reduce((sum, batch) => sum + batch.entries.length, 0);

    if (queuedCount >= this.options.targetFlushSize) {
      this.spawnFlush();
      return;
    }

    if (!this.flushTimer && this.activeFlushes === 0) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.spawnFlush();
      }, this.options.flushIntervalMs);
      this.flushTimer.unref?.();
    }
  }

  private spawnFlush(): void {
    if (this.activeFlushes >= this.options.maxConcurrentFlushes || this.queue.length === 0) {
      return;
    }

    this.activeFlushes += 1;

    void this.runFlushLoop().finally(() => {
      this.activeFlushes -= 1;
      this.scheduleFlush();
    });
  }

  private async runFlushLoop(): Promise<void> {
    while (this.queue.length > 0) {
      const batches = this.takeBatches();
      await this.persist(batches);
    }
  }

  private takeBatches(): PendingBatch[] {
    const batches: PendingBatch[] = [];
    let count = 0;

    while (this.queue.length > 0) {
      const next = this.queue[0] as PendingBatch;

      if (count > 0 && count + next.entries.length > this.options.targetFlushSize) {
        break;
      }

      this.queue.shift();
      batches.push(next);
      count += next.entries.length;
    }

    if (batches.length === 0 && this.queue.length > 0) {
      batches.push(this.queue.shift() as PendingBatch);
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
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}
