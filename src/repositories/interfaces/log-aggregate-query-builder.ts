import type { LogAggregateRequest } from "../../dto/log-aggregate/log-aggregate-request.js";

export interface LogAggregateQuerySql {
  // Parameterized SQL text ready for execution.
  text: string;
  // Ordered parameter values matching the placeholders in the SQL text.
  values: unknown[];
}

export interface ILogAggregateQueryBuilder {
  // Translate the validated request into SQL.
  buildLogAggregateQuery(request: LogAggregateRequest): LogAggregateQuerySql;
}
