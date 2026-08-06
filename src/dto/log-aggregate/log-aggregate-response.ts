export interface LogAggregateBucket {
  start: string;
  group: string | null;
  count: number;
}

export interface LogAggregateResponse {
  buckets: LogAggregateBucket[];
}
