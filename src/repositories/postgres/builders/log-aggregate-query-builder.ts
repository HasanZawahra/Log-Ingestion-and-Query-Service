import {
  PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME,
  PUBLIC_LOGS_TABLE_NAME,
} from "../../../constants/database.js";
import {
  LOG_AGGREGATE_BUCKET_EXPRESSIONS,
  LOG_AGGREGATE_GROUP_BY_EXPRESSION,
  LOG_AGGREGATE_ORDER_BY,
  LOG_ROLLUP_BUCKET_EXPRESSIONS,
} from "../../../constants/log-aggregate-query.js";
import type { LogAggregateRequest } from "../../../dto/log-aggregate/log-aggregate-request.js";
import type {
  ILogAggregateQueryBuilder,
  LogAggregateQuerySql,
} from "../../interfaces/log-aggregate-query-builder.js";
import { encodeAttributeKv } from "../../../utils/attribute-kv.js";

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

export class PostgresLogAggregateQueryBuilder implements ILogAggregateQueryBuilder {
  buildLogAggregateQuery(request: LogAggregateRequest): LogAggregateQuerySql {
    // Raw message searches and attribute filters need the base logs table.
    if (!request.q && Object.keys(request.attributeFilters ?? {}).length === 0) {
      return this.buildRollupAggregateQuery(request);
    }

    // Fall back to scanning the raw logs table when rollup shortcuts are unsafe.
    const params = new ParameterBuilder();
    return this.buildRawAggregateQuery(request, params);
  }

  private buildRollupAggregateQuery(request: LogAggregateRequest): LogAggregateQuerySql {
    // Rollup queries read from the minute summary table.
    const params = new ParameterBuilder();
    const bucketExpression = LOG_ROLLUP_BUCKET_EXPRESSIONS[request.bucket];
    const groupExpression = request.groupBy
      ? LOG_AGGREGATE_GROUP_BY_EXPRESSION[request.groupBy]
      : "NULL::text";
    const clauses: string[] = [
      `bucket_start >= ${params.push(request.since)}`,
      `bucket_start < ${params.push(request.until)}`,
    ];

    if (request.service) {
      // Service filters are exact matches.
      clauses.push(`service = ${params.push(request.service)}`);
    }

    if (request.level) {
      // Level filters are exact matches against the enum column.
      clauses.push(`level = ${params.push(request.level)}`);
    }

    return {
      // Sum the pre-aggregated counts from the summary table.
      text: [
        "SELECT",
        `  ${bucketExpression} AS start`,
        `  , ${groupExpression} AS "group"`,
        "  , SUM(count)::int AS count",
        `FROM ${PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME}`,
        `WHERE ${clauses.join(" AND ")}`,
        "GROUP BY 1, 2",
        LOG_AGGREGATE_ORDER_BY,
      ].join("\n"),
      values: params.getValues(),
    };
  }

  private buildRawAggregateQuery(
    request: LogAggregateRequest,
    params: ParameterBuilder
  ): LogAggregateQuerySql {
    // Raw queries scan the logs table and aggregate on the fly.
    const bucketExpression = LOG_AGGREGATE_BUCKET_EXPRESSIONS[request.bucket];
    const groupExpression = request.groupBy
      ? LOG_AGGREGATE_GROUP_BY_EXPRESSION[request.groupBy]
      : "NULL::text";
    const clauses: string[] = [
      `timestamp >= ${params.push(request.since)}`,
      `timestamp < ${params.push(request.until)}`,
    ];

    if (request.service) {
      // Service filters are exact matches.
      clauses.push(`service = ${params.push(request.service)}`);
    }

    if (request.level) {
      // Level filters are exact matches against the enum column.
      clauses.push(`level = ${params.push(request.level)}`);
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

    return {
      // Count raw rows directly when the query cannot use the rollup table.
      text: [
        "SELECT",
        `  ${bucketExpression} AS start`,
        `  , ${groupExpression} AS "group"`,
        "  , COUNT(*)::int AS count",
        `FROM ${PUBLIC_LOGS_TABLE_NAME}`,
        `WHERE ${clauses.join(" AND ")}`,
        "GROUP BY 1, 2",
        LOG_AGGREGATE_ORDER_BY,
      ].join("\n"),
      values: params.getValues(),
    };
  }
}

export function buildLogAggregateQuery(request: LogAggregateRequest): LogAggregateQuerySql {
  // Preserve the historical helper for older tests and call sites.
  return new PostgresLogAggregateQueryBuilder().buildLogAggregateQuery(request);
}
