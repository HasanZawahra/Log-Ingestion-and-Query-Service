import type { IngestLogEntry } from "../../dto/ingest-request.js";
import { EmptyBulkInsertError } from "../../errors/empty-bulk-insert-error.js";

const LOG_INSERT_FIELD_COUNT = 5;

export const MAX_LOGS_PER_INSERT = 1000;

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
      INSERT INTO public.logs (timestamp, level, service, message, attributes)
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
