import type { LogAggregateRequest } from "../../dto/log-aggregate/log-aggregate-request.js";

export interface LogAggregateQuerySql {
  text: string;
  values: unknown[];
}

export interface ILogAggregateQueryBuilder {
  buildLogAggregateQuery(request: LogAggregateRequest): LogAggregateQuerySql;
}
