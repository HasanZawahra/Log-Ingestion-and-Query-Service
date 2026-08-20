import { describe, expect, it } from "vitest";
import { buildLogAggregateQuery } from "../../repositories/postgres/builders/log-aggregate-query-builder.js";

describe("buildLogAggregateQuery", () => {
  it("builds a grouped aggregation query with all filters", () => {
    // When filters are present, the builder should aggregate from raw logs.
    const query = buildLogAggregateQuery({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "5m",
      groupBy: "service",
      service: "checkout",
      level: "info",
      q: "payment failed",
      attributeFilters: {
        region: "eu-west",
      },
    });

    expect(query.text).toContain(
      "date_bin(interval '5 minutes', timestamp, '1970-01-01 00:00:00+00'::timestamptz) AS start"
    );
    expect(query.text).toContain('service::text AS "group"');
    expect(query.text).toContain("COUNT(*)::int AS count");
    expect(query.text).toContain("FROM public.logs");
    expect(query.text).toContain(
      "WHERE timestamp >= $1 AND timestamp < $2 AND service = $3 AND level = $4 AND message ILIKE $5 AND logs_attributes_kv(attributes) @> ARRAY[$6]"
    );
    expect(query.text).toContain("GROUP BY 1, 2");
    expect(query.text).toContain('ORDER BY start ASC, "group" ASC NULLS FIRST');
    expect(query.values).toEqual([
      "2026-08-03T10:00:00.000Z",
      "2026-08-03T11:00:00.000Z",
      "checkout",
      "info",
      "%payment failed%",
      "6:region=eu-west",
    ]);
  });

  it("builds a raw aggregation query over the logs table when only q is present", () => {
    // Message search requires scanning the base logs table instead of the rollup table.
    const query = buildLogAggregateQuery({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
      q: "payment failed",
    });

    expect(query.text).toContain("FROM public.logs");
    expect(query.text).toContain("WHERE timestamp >= $1 AND timestamp < $2");
    expect(query.text).toContain("message ILIKE $3");
    expect(query.values).toEqual([
      "2026-08-03T10:00:00.000Z",
      "2026-08-03T11:00:00.000Z",
      "%payment failed%",
    ]);
  });

  it("builds a rollup query over the minute aggregates with a null group when no filters are present", () => {
    // The no-filter path should use the precomputed minute rollup table.
    const query = buildLogAggregateQuery({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
    });

    expect(query.text).toContain("SELECT");
    expect(query.text).toContain("bucket_start AS start");
    expect(query.text).toContain('NULL::text AS "group"');
    expect(query.text).toContain("SUM(count)::int AS count");
    expect(query.text).toContain("FROM public.log_minute_aggregates");
    expect(query.text).toContain("WHERE bucket_start >= $1 AND bucket_start < $2");
    expect(query.values).toEqual(["2026-08-03T10:00:00.000Z", "2026-08-03T11:00:00.000Z"]);
  });

  it("rolls up minute buckets when a larger bucket is requested without filters", () => {
    // Larger buckets should be derived from the minute rollup table, not raw logs.
    const query = buildLogAggregateQuery({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1h",
    });

    expect(query.text).toContain(
      "date_bin(interval '1 hour', bucket_start, '1970-01-01 00:00:00+00'::timestamptz) AS start"
    );
    expect(query.text).toContain("FROM public.log_minute_aggregates");
  });
});
