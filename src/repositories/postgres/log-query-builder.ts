import { PUBLIC_LOGS_TABLE_NAME } from "../../constants/database.js";
import { MAX_LOG_QUERY_LIMIT } from "../../constants/log.js";
import { LOG_QUERY_ORDER_BY, LOG_QUERY_SELECT_COLUMNS } from "../../constants/log-query.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import { decodeLogCursor } from "../../utils/log-cursor.js";
import type { ILogQueryBuilder, LogQuerySql } from "../interfaces/log-query-builder.js";

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

    if (request.cursor) {
      const cursor = decodeLogCursor(request.cursor);

      if (!cursor) {
        throw new Error("invalid log cursor");
      }

      clauses.push(`(timestamp, id) < (${params.push(cursor.timestamp)}, ${params.push(cursor.id)})`);
    }

    const attributeFilters = Object.entries(request.attributeFilters ?? {}).sort(([left], [right]) =>
      left.localeCompare(right)
    );

    for (const [key, value] of attributeFilters) {
      clauses.push(`attributes @> ${params.push(JSON.stringify({ [key]: value }))}::jsonb`);
    }

    const limit = request.limit ?? MAX_LOG_QUERY_LIMIT;
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return {
      text: [
        `SELECT ${LOG_QUERY_SELECT_COLUMNS}`,
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
  return new PostgresLogQueryBuilder().buildLogQuery(request);
}
