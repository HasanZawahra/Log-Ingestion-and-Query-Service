import { PUBLIC_LOGS_TABLE_NAME } from "../../../constants/database.js";
import { DEFAULT_LOG_QUERY_LIMIT } from "../../../constants/log.js";
import { LOG_QUERY_ORDER_BY, LOG_QUERY_SELECT_COLUMNS } from "../../../constants/log-query.js";
import type { LogQueryRequest } from "../../../dto/log-query/log-query-request.js";
import { InvalidLogCursorError } from "../../../errors/logs/invalid-log-cursor-error.js";
import { encodeAttributeKv } from "../../../utils/attribute-kv.js";
import { decodeLogCursor } from "../../../utils/log-cursor.js";
import type { ILogQueryBuilder, LogQuerySql } from "../../interfaces/log-query-builder.js";

const ATTRIBUTE_MATCHES_CTE = "attribute_matches";

class ParameterBuilder {
  private readonly values: unknown[] = [];

  push(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }

  getValues(): unknown[] {
    return this.values;
  }
}

export class PostgresLogQueryBuilder implements ILogQueryBuilder {
  buildLogQuery(request: LogQueryRequest): LogQuerySql {
    const params = new ParameterBuilder();

    const cursor = request.cursor ? decodeLogCursor(request.cursor) : null;
    if (request.cursor && !cursor) {
      throw new InvalidLogCursorError();
    }

    const attributeFilters = Object.entries(request.attributeFilters ?? {}).sort(
      ([left], [right]) => left.localeCompare(right)
    );

    const attributeClauses = attributeFilters.map(([key, value]) => {
      return `logs_attributes_kv(attributes) @> ARRAY[${params.push(encodeAttributeKv(key, value))}]`;
    });

    if (attributeClauses.length > 0) {
      return this.buildAttributeDrivenQuery(request, params, cursor, attributeClauses);
    }

    return this.buildFlatQuery(request, params, cursor);
  }

  private buildFlatQuery(
    request: LogQueryRequest,
    params: ParameterBuilder,
    cursor: { timestamp: string; id: number } | null
  ): LogQuerySql {
    const clauses: string[] = [];

    if (request.service) {
      clauses.push(`service = ${params.push(request.service)}`);
    }

    if (request.level) {
      clauses.push(`level = ${params.push(request.level)}`);
    }

    if (request.since) {
      clauses.push(`timestamp >= ${params.push(request.since)}`);
    }

    if (request.until) {
      clauses.push(`timestamp < ${params.push(request.until)}`);
    }

    if (request.q) {
      clauses.push(`message ILIKE ${params.push(`%${request.q}%`)}`);
    }

    if (cursor) {
      clauses.push(
        `(timestamp, id) < (${params.push(cursor.timestamp)}, ${params.push(cursor.id)})`
      );
    }

    const limit = request.limit ?? DEFAULT_LOG_QUERY_LIMIT;
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return {
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

  private buildAttributeDrivenQuery(
    request: LogQueryRequest,
    params: ParameterBuilder,
    cursor: { timestamp: string; id: number } | null,
    attributeClauses: string[]
  ): LogQuerySql {
    const clauses: string[] = [];

    if (request.service) {
      clauses.push(`service = ${params.push(request.service)}`);
    }

    if (request.level) {
      clauses.push(`level = ${params.push(request.level)}`);
    }

    if (request.since) {
      clauses.push(`timestamp >= ${params.push(request.since)}`);
    }

    if (request.until) {
      clauses.push(`timestamp < ${params.push(request.until)}`);
    }

    if (request.q) {
      clauses.push(`message ILIKE ${params.push(`%${request.q}%`)}`);
    }

    if (cursor) {
      clauses.push(
        `(timestamp, id) < (${params.push(cursor.timestamp)}, ${params.push(cursor.id)})`
      );
    }

    const limit = request.limit ?? DEFAULT_LOG_QUERY_LIMIT;
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return {
      text: [
        `WITH ${ATTRIBUTE_MATCHES_CTE} AS MATERIALIZED (`,
        `  SELECT id, timestamp, level, service, message, attributes`,
        `  FROM ${PUBLIC_LOGS_TABLE_NAME}`,
        `  WHERE ${attributeClauses.join(" AND ")}`,
        `)`,
        `SELECT ${LOG_QUERY_SELECT_COLUMNS}`,
        `, to_char(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_timestamp`,
        `FROM ${ATTRIBUTE_MATCHES_CTE}`,
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
  return new PostgresLogQueryBuilder().buildLogQuery(request);
}