import { pool } from "../../config/database.js";
import { LOGS_TABLE_EXISTENCE_QUERY } from "../../constants/database.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import type { LogAggregateRequest } from "../../dto/log-aggregate/log-aggregate-request.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import type { LogQueryEntry, LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { MissingLogsTableError } from "../../errors/database/missing-logs-table-error.js";
import { encodeLogCursor } from "../../utils/log-cursor.js";
import type { ILogAggregateQueryBuilder } from "../interfaces/log-aggregate-query-builder.js";
import type { ILogQueryBuilder } from "../interfaces/log-query-builder.js";
import type { ILogRepository } from "../interfaces/log-repository.js";
import { IngestBatcher } from "./ingest-batcher.js";
import { PostgresLogAggregateQueryBuilder } from "./builders/log-aggregate-query-builder.js";
import { DEFAULT_LOG_QUERY_LIMIT } from "../../constants/log.js";
import { PostgresLogQueryBuilder } from "./builders/log-query-builder.js";

export class PostgresLogRepository implements ILogRepository {
  private readonly ingestBatcher = new IngestBatcher();

  constructor(
    private readonly logQueryBuilder: ILogQueryBuilder = new PostgresLogQueryBuilder(),
    private readonly logAggregateQueryBuilder: ILogAggregateQueryBuilder = new PostgresLogAggregateQueryBuilder()
  ) {}

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

    await this.ingestBatcher.save(entries);
  }

  async flushPendingLogs(): Promise<void> {
    await this.ingestBatcher.flushPending();
  }

  async closeIngestBatcher(): Promise<void> {
    await this.ingestBatcher.flushPending();
    this.ingestBatcher.close();
  }

  async queryLogs(request: LogQueryRequest): Promise<LogQueryResponse> {
    const pageSize = request.limit ?? DEFAULT_LOG_QUERY_LIMIT;
    const query = this.logQueryBuilder.buildLogQuery({
      ...request,
      limit: pageSize + 1,
    });

    const client = await pool.connect();

    try {
      const { rows } = await client.query(query.text, query.values);
      const hasNextPage = rows.length > pageSize;
      const visibleRows = hasNextPage ? rows.slice(0, pageSize) : rows;
      const logs = visibleRows.map(mapLogQueryEntry);
      const lastRow = visibleRows.at(-1);

      return {
        logs,
        next_cursor:
          hasNextPage && lastRow
            ? encodeLogCursor({
                timestamp:
                  (lastRow.cursor_timestamp as string | undefined) ??
                  normalizeTimestamp(lastRow.timestamp),
                id: Number(lastRow.id),
              })
            : null,
      };
    } finally {
      client.release();
    }
  }

  async queryLogAggregates(request: LogAggregateRequest): Promise<LogAggregateResponse> {
    const query = this.logAggregateQueryBuilder.buildLogAggregateQuery(request);
    const client = await pool.connect();

    try {
      const { rows } = await client.query(query.text, query.values);

      return {
        buckets: rows.map(mapLogAggregateBucket),
      };
    } finally {
      client.release();
    }
  }
}

function mapLogQueryEntry(row: Record<string, unknown>): LogQueryEntry {
  return {
    id: String(row.id),
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

function mapLogAggregateBucket(
  row: Record<string, unknown>
): LogAggregateResponse["buckets"][number] {
  return {
    start: normalizeTimestamp(row.start),
    group: row.group === undefined || row.group === null ? null : String(row.group),
    count: Number(row.count),
  };
}
