export interface LogAggregateBucket {
  // Start time for the bucket, serialized as UTC.
  start: string;
  // Group value when group_by is requested.
  group: string | null;
  // Number of matching logs in the bucket.
  count: number;
}

export interface LogAggregateResponse {
  // Sorted aggregate buckets.
  buckets: LogAggregateBucket[];
}
