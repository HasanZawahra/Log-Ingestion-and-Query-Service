import type { IngestLogEntry } from "../../../dto/ingest/ingest-request.js";
import { LOG_INSERT_FIELD_COUNT, MAX_LOGS_PER_INSERT } from "../../../constants/log.js";
import {
  PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME,
  PUBLIC_LOGS_TABLE_NAME,
} from "../../../constants/database.js";
import { EmptyBulkInsertError } from "../../../errors/repository/empty-bulk-insert-error.js";

export interface BulkInsertQuery {
  text: string;
  values: unknown[];
}

export interface AggregateGroup {
  bucketStart: string;
  service: string;
  level: string;
  count: number;
}

export function buildLogsInsert(entries: IngestLogEntry[]): BulkInsertQuery {
  if (entries.length === 0) {
    throw new EmptyBulkInsertError();
  }

  const values = entries.flatMap((entry) => [
    entry.timestamp,
    entry.level,
    entry.service,
    entry.message,
    entry.attributes ?? {},
  ]);

  const valuePlaceholders = entries
    .map((_, index) => {
      const offset = index * LOG_INSERT_FIELD_COUNT;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    })
    .join(", ");

  return {
    text: `
      INSERT INTO ${PUBLIC_LOGS_TABLE_NAME} (timestamp, level, service, message, attributes)
      VALUES ${valuePlaceholders}
    `,
    values,
  };
}

export function groupEntriesForAggregation(entries: IngestLogEntry[]): AggregateGroup[] {
  const groups = new Map<string, AggregateGroup>();

  for (const entry of entries) {
    const bucketStart = toMinuteBucketStart(entry.timestamp);
    const key = `${bucketStart}\u0000${entry.service}\u0000${entry.level}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    groups.set(key, {
      bucketStart,
      service: entry.service,
      level: entry.level,
      count: 1,
    });
  }

  return Array.from(groups.values());
}

export function buildAggregateUpsert(groups: AggregateGroup[]): BulkInsertQuery {
  if (groups.length === 0) {
    throw new EmptyBulkInsertError();
  }

  const values = groups.flatMap((group) => [
    group.bucketStart,
    group.service,
    group.level,
    group.count,
  ]);

  const valuePlaceholders = groups
    .map((_, index) => {
      const offset = index * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    })
    .join(", ");

  return {
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
  const chunks: IngestLogEntry[][] = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }

  return chunks;
}

export function buildBulkInsert(entries: IngestLogEntry[]): BulkInsertQuery {
  return buildLogsInsert(entries);
}

function toMinuteBucketStart(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  const bucketStart = Math.floor(parsed / MINUTE_MS) * MINUTE_MS;
  return new Date(bucketStart).toISOString();
}

const MINUTE_MS = 60_000;
