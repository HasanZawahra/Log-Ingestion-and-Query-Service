import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";

export interface LogQuerySql {
  text: string;
  values: unknown[];
}

export interface ILogQueryBuilder {
  buildLogQuery(request: LogQueryRequest): LogQuerySql;
}
