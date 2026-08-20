// The query builder selects only the columns needed by the public response.
export const LOG_QUERY_SELECT_COLUMNS = "id, timestamp, level, service, message, attributes";
// Timestamp is the primary sort key, with id as the deterministic tiebreaker.
export const LOG_QUERY_ORDER_BY = "ORDER BY timestamp DESC NULLS LAST, id DESC NULLS LAST";
