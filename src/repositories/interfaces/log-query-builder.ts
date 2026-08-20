import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";

export interface LogQuerySql {
  // Parameterized SQL text ready for execution.
  text: string;
  // Ordered parameter values matching the placeholders in the SQL text.
  values: unknown[];
}

export interface ILogQueryBuilder {
  // Translate the validated request into SQL.
  buildLogQuery(request: LogQueryRequest): LogQuerySql;
}
