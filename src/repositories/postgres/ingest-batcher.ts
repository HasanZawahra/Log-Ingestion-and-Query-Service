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
  // Keep each flush within the repository's preferred bulk insert size.
  targetFlushSize: MAX_LOGS_PER_INSERT,
  // Allow a few concurrent flushes without overwhelming the database.
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
      // Nothing to persist means the caller can resolve immediately.
      return Promise.resolve();
    }

    if (this.closed) {
      // Reject new work once shutdown has begun.
      return Promise.reject(new Error("IngestBatcher is closed"));
    }

    return new Promise<void>((resolve, reject) => {
      // Queue the batch and wake any waiting flush loop.
      this.queue.push({ entries, resolve, reject });
      this.wakeAll();
      this.spawnFlush();
    });
  }

  async flushPending(): Promise<void> {
    // Make sure at least one flush loop is running before waiting.
    this.spawnFlush();

    while (this.queue.length > 0 || this.activeFlushes > 0) {
      // Keep nudging waiters until the queue and active flushes are empty.
      this.wakeAll();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  close(): void {
    // Prevent new work from being accepted during shutdown.
    this.closed = true;
    this.wakeAll();
  }

  private wakeAll(): void {
    // Move the current waiter set into a local array before invoking callbacks.
    const waiters = Array.from(this.waiters);
    this.waiters.clear();

    for (const waiter of waiters) {
      // Each waiter re-checks the queue and drains a batch if possible.
      waiter();
    }
  }

  private spawnFlush(): void {
    if (this.activeFlushes >= this.options.maxConcurrentFlushes || this.queue.length === 0) {
      // Either the pool of flush workers is full or there is no work yet.
      return;
    }

    // Reserve a flush worker before starting the async loop.
    this.activeFlushes += 1;

    void this.runFlushLoop().finally(() => {
      // Release the worker slot and try to start another flush immediately.
      this.activeFlushes -= 1;
      this.spawnFlush();
    });
  }

  private async runFlushLoop(): Promise<void> {
    while (this.queue.length > 0) {
      // Wait until enough batches have accumulated to justify a flush.
      const batches = await this.waitForBatches();

      if (batches.length === 0) {
        // Shutdown or spurious wakeup with no usable work.
        break;
      }

      // Persist all queued entries in one transaction.
      await this.persist(batches);
    }
  }

  private waitForBatches(): Promise<PendingBatch[]> {
    return new Promise((resolve) => {
      const finish = () => {
        // Remove the waiter before resolving so it does not fire twice.
        this.waiters.delete(finish);
        resolve(this.takeBatches());
      };

      // Register the waiter and also schedule an immediate re-check.
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
        // Stop before exceeding the preferred flush size.
        break;
      }

      // Accumulate batches until the target size is reached.
      batches.push(next);
      count += next.entries.length;
      index++;
    }

    if (index === 0 && this.queue.length > 0) {
      // Always flush at least one batch so the queue makes progress.
      batches.push(this.queue[0] as PendingBatch);
      index = 1;
    }

    if (index > 0) {
      // Remove the drained batches from the queue in one operation.
      this.queue.splice(0, index);
    }

    return batches;
  }

  private async persist(batches: PendingBatch[]): Promise<void> {
    // Flatten the queued batches into one write transaction.
    const entries = batches.flatMap((batch) => batch.entries);

    try {
      // Delegate the actual database work to the shared persistence helper.
      await persistEntries(entries);
      batches.forEach((batch) => batch.resolve());
    } catch (error) {
      // Fail every batch in the group if the transaction fails.
      batches.forEach((batch) => batch.reject(error));
    }
  }
}

export async function persistEntries(entries: IngestLogEntry[]): Promise<void> {
  if (entries.length === 0) {
    // The persistence helper is a no-op for empty input.
    return;
  }

  // Acquire a connection for the full transaction.
  const client = await pool.connect();

  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        // Use a manual transaction so logs and aggregates stay consistent.
        await client.query("BEGIN");

        try {
          // Chunk the insert when the batch is larger than the statement limit.
          for (const chunk of chunkLogEntries(entries)) {
            const query = buildLogsInsert(chunk);
            await client.query(query.text, query.values);
          }

          // Update the rollup table in the same transaction as the raw rows.
          const groups = groupEntriesForAggregation(entries);
          const aggregateQuery = buildAggregateUpsert(groups);
          await client.query(aggregateQuery.text, aggregateQuery.values);

          // Commit once both the raw and aggregate writes succeed.
          await client.query("COMMIT");
          return;
        } catch (error) {
          // Roll back the transaction if either insert path fails.
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
          // Non-deadlock failures are surfaced immediately.
          throw error;
        }
      }
    }
  } finally {
    // Return the connection to the pool no matter what happened above.
    client.release();
  }
}
