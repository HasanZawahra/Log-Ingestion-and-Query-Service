import { pool } from "../../config/database.js";
import { LOGS_TABLE_EXISTENCE_QUERY } from "../../constants/database.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import type { LogQueryEntry, LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { MissingLogsTableError } from "../../errors/database/missing-logs-table-error.js";
import { encodeLogCursor } from "../../utils/log-cursor.js";
import type { ILogQueryBuilder } from "../interfaces/log-query-builder.js";
import type { ILogRepository } from "../interfaces/log-repository.js";
import { buildBulkInsert, chunkLogEntries } from "./log-bulk-insert-query.js";
import { PostgresLogQueryBuilder } from "./log-query-builder.js";
import { MAX_LOG_QUERY_LIMIT } from "../../constants/log.js";

export class PostgresLogRepository implements ILogRepository {
  constructor(private readonly logQueryBuilder: ILogQueryBuilder = new PostgresLogQueryBuilder()) {}

  async ensureSchemaReady(): Promise<void> {
    const client = await pool.connect();

    try {
      const { rows } = await client.query(LOGS_TABLE_EXISTENCE_QUERY);

      const tableExists = rows[0]?.table_name === "logs";

      if (!tableExists) {
        throw new MissingLogsTableError();
      }
    } finally {
      client.release();
    }
  }

  async saveLogs(entries: IngestLogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const client = await pool.connect();

    try {
      for (const chunk of chunkLogEntries(entries)) {
        const query = buildBulkInsert(chunk);
        await client.query(query.text, query.values);
      }
    } finally {
      client.release();
    }
  }

  async queryLogs(request: LogQueryRequest): Promise<LogQueryResponse> {
    const pageSize = request.limit ?? MAX_LOG_QUERY_LIMIT;
    const query = this.logQueryBuilder.buildLogQuery({
      ...request,
      limit: pageSize + 1,
    });

    const client = await pool.connect();

    try {
      const { rows } = await client.query(query.text, query.values);
      const hasNextPage = rows.length > pageSize;
      const visibleRows = hasNextPage ? rows.slice(0, pageSize) : rows;
      const entries = visibleRows.map(mapLogQueryEntry);
      const lastEntry = entries.at(-1);

      return {
        entries,
        next_cursor: hasNextPage && lastEntry ? encodeLogCursor({ timestamp: lastEntry.timestamp, id: lastEntry.id }) : null,
      };
    } finally {
      client.release();
    }
  }
}

function mapLogQueryEntry(row: Record<string, unknown>): LogQueryEntry {
  return {
    id: Number(row.id),
    timestamp: normalizeTimestamp(row.timestamp),
    level: row.level as LogQueryEntry["level"],
    service: String(row.service),
    message: String(row.message),
    attributes: (row.attributes as Record<string, unknown>) ?? {},
  };
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}
