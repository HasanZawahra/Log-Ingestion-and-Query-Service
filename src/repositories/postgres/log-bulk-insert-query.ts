import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import {
  LOG_INSERT_FIELD_COUNT,
  MAX_LOGS_PER_INSERT,
} from "../../constants/log.js";
import { PUBLIC_LOGS_TABLE_NAME } from "../../constants/database.js";
import { EmptyBulkInsertError } from "../../errors/repository/empty-bulk-insert-error.js";

export interface BulkInsertQuery {
  text: string;
  values: unknown[];
}

export function buildBulkInsert(entries: IngestLogEntry[]): BulkInsertQuery {
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
