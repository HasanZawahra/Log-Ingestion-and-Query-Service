import { PUBLIC_LOGS_TABLE_NAME } from "../../../constants/database.js";
import { DEFAULT_LOG_QUERY_LIMIT } from "../../../constants/log.js";
import { LOG_QUERY_ORDER_BY, LOG_QUERY_SELECT_COLUMNS } from "../../../constants/log-query.js";
import type { LogQueryRequest } from "../../../dto/log-query/log-query-request.js";
import { InvalidLogCursorError } from "../../../errors/logs/invalid-log-cursor-error.js";
import { encodeAttributeKv } from "../../../utils/attribute-kv.js";
import { decodeLogCursor } from "../../../utils/log-cursor.js";
import type { ILogQueryBuilder, LogQuerySql } from "../../interfaces/log-query-builder.js";

class ParameterBuilder {
  private readonly values: unknown[] = [];

  push(value: unknown): string {
    // Store the value and return the matching placeholder token.
    this.values.push(value);
    return `$${this.values.length}`;
  }

  getValues(): unknown[] {
    // The query executor consumes the values in placeholder order.
    return this.values;
  }
}

export class PostgresLogQueryBuilder implements ILogQueryBuilder {
  buildLogQuery(request: LogQueryRequest): LogQuerySql {
    // Keep parameter numbering centralized so clauses stay easy to build.
    const params = new ParameterBuilder();

    const cursor = request.cursor ? decodeLogCursor(request.cursor) : null;
    if (request.cursor && !cursor) {
      // Invalid cursors are rejected before any SQL is executed.
      throw new InvalidLogCursorError();
    }

    // Build the WHERE clause from whichever filters the caller provided.
    const clauses: string[] = [];

    if (request.service) {
      // Service filters are exact matches.
      clauses.push(`service = ${params.push(request.service)}`);
    }

    if (request.level) {
      // Level filters are exact matches against the enum column.
      clauses.push(`level = ${params.push(request.level)}`);
    }

    if (request.since) {
      // Since is inclusive.
      clauses.push(`timestamp >= ${params.push(request.since)}`);
    }

    if (request.until) {
      // Until is exclusive.
      clauses.push(`timestamp < ${params.push(request.until)}`);
    }

    if (request.q) {
      // Message search is case-insensitive substring matching.
      clauses.push(`message ILIKE ${params.push(`%${request.q}%`)}`);
    }

    // Sort attribute filters so parameter order stays deterministic.
    const attributeFilters = Object.entries(request.attributeFilters ?? {}).sort(
      ([left], [right]) => left.localeCompare(right)
    );

    for (const [key, value] of attributeFilters) {
      // Encode each key/value pair into the compact containment format.
      clauses.push(
        `logs_attributes_kv(attributes) @> ARRAY[${params.push(encodeAttributeKv(key, value))}]`
      );
    }

    if (cursor) {
      // The cursor carries the final timestamp/id pair from the previous page.
      clauses.push(
        `(timestamp, id) < (${params.push(cursor.timestamp)}, ${params.push(cursor.id)})`
      );
    }

    // Default to the configured page size when the caller omits a limit.
    const limit = request.limit ?? DEFAULT_LOG_QUERY_LIMIT;
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return {
      // Cursor_timestamp is returned only to make the next page token stable.
      text: [
        `SELECT ${LOG_QUERY_SELECT_COLUMNS}`,
        `, to_char(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_timestamp`,
        `FROM ${PUBLIC_LOGS_TABLE_NAME}`,
        whereClause,
        LOG_QUERY_ORDER_BY,
        `LIMIT ${params.push(limit)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      values: params.getValues(),
    };
  }
}

export function buildLogQuery(request: LogQueryRequest): LogQuerySql {
  // Preserve the historical helper for older tests and call sites.
  return new PostgresLogQueryBuilder().buildLogQuery(request);
}
