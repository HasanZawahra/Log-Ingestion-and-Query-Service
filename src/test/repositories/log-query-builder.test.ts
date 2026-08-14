import { describe, expect, it } from "vitest";
import { DEFAULT_LOG_QUERY_LIMIT } from "../../constants/log.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import { InvalidLogCursorError } from "../../errors/logs/invalid-log-cursor-error.js";
import { buildLogQuery } from "../../repositories/postgres/builders/log-query-builder.js";
import { encodeLogCursor } from "../../utils/log-cursor.js";

describe("buildLogQuery", () => {
  it("builds a service-only query", () => {
    const query = buildLogQuery({
      service: "checkout",
    });

    expect(query.text).toContain("WHERE service = $1");
    expect(query.text).toContain("LIMIT $2");
    expect(query.values).toEqual(["checkout", DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("builds a level-only query", () => {
    const query = buildLogQuery({
      level: "error",
    });

    expect(query.text).toContain("WHERE level = $1");
    expect(query.text).toContain("LIMIT $2");
    expect(query.values).toEqual(["error", DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("builds a time-range query", () => {
    const query = buildLogQuery({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
    });

    expect(query.text).toContain("WHERE timestamp >= $1 AND timestamp < $2");
    expect(query.text).toContain("LIMIT $3");
    expect(query.values).toEqual([
      "2026-08-03T10:00:00.000Z",
      "2026-08-03T11:00:00.000Z",
      DEFAULT_LOG_QUERY_LIMIT,
    ]);
  });

  it("builds an attribute-filter query driven by the GIN index", () => {
    const query = buildLogQuery({
      attributeFilters: {
        region: "eu-west",
      },
    });

    expect(query.text).toContain("WITH attribute_matches AS MATERIALIZED (");
    expect(query.text).toContain("WHERE logs_attributes_kv(attributes) @> ARRAY[$1]");
    expect(query.text).toContain("FROM attribute_matches");
    expect(query.text).toContain("LIMIT $2");
    expect(query.values).toEqual(["6:region=eu-west", DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("builds a message-search query", () => {
    const query = buildLogQuery({
      q: "payment failed",
    });

    expect(query.text).toContain("WHERE message ILIKE $1");
    expect(query.text).toContain("LIMIT $2");
    expect(query.values).toEqual(["%payment failed%", DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("builds a cursor query clause", () => {
    const cursor = encodeLogCursor({
      timestamp: "2026-08-03T10:30:00.000Z",
      id: 44,
    });

    const query = buildLogQuery({
      cursor,
    });

    expect(query.text).toContain("WHERE (timestamp, id) < ($1, $2)");
    expect(query.text).toContain("LIMIT $3");
    expect(query.values).toEqual(["2026-08-03T10:30:00.000Z", 44, DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("builds a parameterized query with all supported filters", () => {
    const cursor = encodeLogCursor({
      timestamp: "2026-08-03T10:30:00.000Z",
      id: 44,
    });

    const request: LogQueryRequest = {
      service: "checkout",
      level: "info",
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      q: "payment failed",
      limit: 25,
      cursor,
      attributeFilters: {
        region: "eu-west",
        requestId: "req-123",
      },
    };

    const query = buildLogQuery(request);

    expect(query.text).toContain("WITH attribute_matches AS MATERIALIZED (");
    expect(query.text).toContain(
      "FROM attribute_matches"
    );
    expect(query.text).toContain("SELECT id, timestamp, level, service, message, attributes");
    expect(query.text).toContain(
      "WHERE logs_attributes_kv(attributes) @> ARRAY[$1] AND logs_attributes_kv(attributes) @> ARRAY[$2]"
    );
    expect(query.text).toContain(
      "WHERE service = $3 AND level = $4 AND timestamp >= $5 AND timestamp < $6 AND message ILIKE $7 AND (timestamp, id) < ($8, $9)"
    );
    expect(query.text).toContain("ORDER BY timestamp DESC NULLS LAST, id DESC NULLS LAST");
    expect(query.text).toContain("LIMIT $10");
    expect(query.values).toEqual([
      "6:region=eu-west",
      "9:requestId=req-123",
      "checkout",
      "info",
      "2026-08-03T10:00:00.000Z",
      "2026-08-03T11:00:00.000Z",
      "%payment failed%",
      "2026-08-03T10:30:00.000Z",
      44,
      25,
    ]);
  });

  it("uses the default query limit when no limit is provided", () => {
    const query = buildLogQuery({});

    expect(query.text).toContain("LIMIT $1");
    expect(query.values).toEqual([DEFAULT_LOG_QUERY_LIMIT]);
  });

  it("throws a custom application error when the cursor is invalid", () => {
    expect(() =>
      buildLogQuery({
        cursor: "not-a-cursor",
      })
    ).toThrow(InvalidLogCursorError);
  });
});
