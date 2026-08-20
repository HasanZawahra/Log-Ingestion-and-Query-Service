import type { IngestLogEntry } from "../../../dto/ingest/ingest-request.js";
import { LOG_INSERT_FIELD_COUNT, MAX_LOGS_PER_INSERT } from "../../../constants/log.js";
import {
  PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME,
  PUBLIC_LOGS_TABLE_NAME,
} from "../../../constants/database.js";
import { EmptyBulkInsertError } from "../../../errors/repository/empty-bulk-insert-error.js";

export interface BulkInsertQuery {
  // Parameterized SQL ready for execution.
  text: string;
  // Values aligned with the generated placeholders.
  values: unknown[];
}

export interface AggregateGroup {
  // Minute bucket start used for the rollup table.
  bucketStart: string;
  // Service dimension for the aggregate row.
  service: string;
  // Severity dimension for the aggregate row.
  level: string;
  // Number of raw entries folded into the group.
  count: number;
}

export function buildLogsInsert(entries: IngestLogEntry[]): BulkInsertQuery {
  if (entries.length === 0) {
    // The caller should never ask for an empty bulk insert.
    throw new EmptyBulkInsertError();
  }

  // Flatten each entry into the column order expected by the table.
  const values = entries.flatMap((entry) => [
    entry.timestamp,
    entry.level,
    entry.service,
    entry.message,
    entry.attributes ?? {},
  ]);

  const valuePlaceholders = entries
    .map((_, index) => {
      // Generate one placeholder tuple per entry.
      const offset = index * LOG_INSERT_FIELD_COUNT;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    })
    .join(", ");

  return {
    // Write the raw logs using a single bulk insert statement.
    text: `
      INSERT INTO ${PUBLIC_LOGS_TABLE_NAME} (timestamp, level, service, message, attributes)
      VALUES ${valuePlaceholders}
    `,
    values,
  };
}

export function groupEntriesForAggregation(entries: IngestLogEntry[]): AggregateGroup[] {
  // Grouping keeps aggregate writes small and idempotent within a batch.
  const groups = new Map<string, AggregateGroup>();

  for (const entry of entries) {
    // Logs are rolled up into minute buckets before they are upserted.
    const bucketStart = toMinuteBucketStart(entry.timestamp);
    const key = `${bucketStart}\u0000${entry.service}\u0000${entry.level}`;
    const existing = groups.get(key);

    if (existing) {
      // Merge duplicate rows in the same bucket/service/level group.
      existing.count += 1;
      continue;
    }

    // Seed a new aggregate group for this key.
    groups.set(key, {
      bucketStart,
      service: entry.service,
      level: entry.level,
      count: 1,
    });
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      // Stable sort keeps the generated SQL values deterministic.
      left.bucketStart.localeCompare(right.bucketStart) ||
      left.service.localeCompare(right.service) ||
      left.level.localeCompare(right.level)
  );
}

export function buildAggregateUpsert(groups: AggregateGroup[]): BulkInsertQuery {
  if (groups.length === 0) {
    // The aggregate insert helper should only be used with real groups.
    throw new EmptyBulkInsertError();
  }

  // Flatten each grouped count into the order expected by the UPSERT.
  const values = groups.flatMap((group) => [
    group.bucketStart,
    group.service,
    group.level,
    group.count,
  ]);

  const valuePlaceholders = groups
    .map((_, index) => {
      // Generate one placeholder tuple per aggregate row.
      const offset = index * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    })
    .join(", ");

  return {
    // Upsert the minute rollups so reads can use the summary table.
    text: `
      INSERT INTO ${PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME} (bucket_start, service, level, count)
      VALUES ${valuePlaceholders}
      ON CONFLICT (bucket_start, service, level)
      DO UPDATE SET count = ${PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME}.count + EXCLUDED.count
    `,
    values,
  };
}

export function chunkLogEntries(
  entries: IngestLogEntry[],
  chunkSize = MAX_LOGS_PER_INSERT
): IngestLogEntry[][] {
  // Split very large batches so the SQL statement stays within limits.
  const chunks: IngestLogEntry[][] = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    // Slice each chunk without mutating the original array.
    chunks.push(entries.slice(index, index + chunkSize));
  }

  return chunks;
}

export function buildBulkInsert(entries: IngestLogEntry[]): BulkInsertQuery {
  // Compatibility wrapper retained for older call sites.
  return buildLogsInsert(entries);
}

function toMinuteBucketStart(timestamp: string): string {
  // Snap the timestamp down to the start of the UTC minute.
  const parsed = Date.parse(timestamp);
  const bucketStart = Math.floor(parsed / MINUTE_MS) * MINUTE_MS;
  return new Date(bucketStart).toISOString();
}

// One minute expressed in milliseconds.
const MINUTE_MS = 60_000;
