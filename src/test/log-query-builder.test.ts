import { describe, expect, it } from "vitest";
import { MAX_LOG_QUERY_LIMIT } from "../constants/log.js";
import type { LogQueryRequest } from "../dto/log-query/log-query-request.js";
import { buildLogQuery } from "../repositories/postgres/log-query-builder.js";
import { encodeLogCursor } from "../utils/log-cursor.js";

describe("buildLogQuery", () => {
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

    expect(query.text).toContain("SELECT id, timestamp, level, service, message, attributes");
    expect(query.text).toContain("FROM public.logs");
    expect(query.text).toContain(
      "WHERE service = $1 AND level = $2 AND timestamp >= $3 AND timestamp < $4 AND message ILIKE $5 AND (timestamp, id) < ($6, $7) AND attributes @> $8::jsonb AND attributes @> $9::jsonb"
    );
    expect(query.text).toContain("ORDER BY timestamp DESC, id DESC");
    expect(query.text).toContain("LIMIT $10");
    expect(query.values).toEqual([
      "checkout",
      "info",
      "2026-08-03T10:00:00.000Z",
      "2026-08-03T11:00:00.000Z",
      "%payment failed%",
      "2026-08-03T10:30:00.000Z",
      44,
      JSON.stringify({ region: "eu-west" }),
      JSON.stringify({ requestId: "req-123" }),
      25,
    ]);
  });

  it("uses the maximum query limit when no limit is provided", () => {
    const query = buildLogQuery({});

    expect(query.text).toContain("LIMIT $1");
    expect(query.values).toEqual([MAX_LOG_QUERY_LIMIT]);
  });
});
