import { describe, expect, it } from "vitest";
import { MAX_LOGS_PER_INSERT } from "../../constants/log.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import { EmptyBulkInsertError } from "../../errors/repository/empty-bulk-insert-error.js";
import {
  buildAggregateUpsert,
  buildLogsInsert,
  chunkLogEntries,
  groupEntriesForAggregation,
} from "../../repositories/postgres/builders/log-bulk-insert-query.js";

function createEntry(index: number): IngestLogEntry {
  return {
    timestamp: `2026-08-03T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
    level: "info",
    service: "checkout",
    message: `event-${index}`,
  };
}

describe("buildLogsInsert", () => {
  it("builds one parameterized multi-row insert query", () => {
    const entries: IngestLogEntry[] = [
      {
        timestamp: "2026-08-03T10:00:00.000Z",
        level: "info",
        service: "checkout",
        message: "created",
        attributes: { requestId: "req-1" },
      },
      {
        timestamp: "2026-08-03T10:00:01.000Z",
        level: "error",
        service: "billing",
        message: "failed",
      },
    ];

    const query = buildLogsInsert(entries);

    expect(query.text).toContain(
      "INSERT INTO public.logs (timestamp, level, service, message, attributes)"
    );
    expect(query.text).toContain("VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)");
    expect(query.values).toEqual([
      "2026-08-03T10:00:00.000Z",
      "info",
      "checkout",
      "created",
      { requestId: "req-1" },
      "2026-08-03T10:00:01.000Z",
      "error",
      "billing",
      "failed",
      {},
    ]);
  });

  it("rejects empty inserts", () => {
    expect(() => buildLogsInsert([])).toThrow(EmptyBulkInsertError);
  });
});

describe("groupEntriesForAggregation", () => {
  it("groups entries by minute bucket, service, and level", () => {
    const groups = groupEntriesForAggregation([
      { timestamp: "2026-08-03T10:00:59.000Z", level: "info", service: "checkout", message: "a" },
      { timestamp: "2026-08-03T10:01:01.000Z", level: "info", service: "checkout", message: "b" },
      { timestamp: "2026-08-03T10:01:30.000Z", level: "info", service: "checkout", message: "c" },
      { timestamp: "2026-08-03T10:01:45.000Z", level: "error", service: "checkout", message: "d" },
      { timestamp: "2026-08-03T10:01:50.000Z", level: "info", service: "billing", message: "e" },
    ]);

    expect(groups).toEqual([
      { bucketStart: "2026-08-03T10:00:00.000Z", service: "checkout", level: "info", count: 1 },
      { bucketStart: "2026-08-03T10:01:00.000Z", service: "checkout", level: "info", count: 2 },
      { bucketStart: "2026-08-03T10:01:00.000Z", service: "checkout", level: "error", count: 1 },
      { bucketStart: "2026-08-03T10:01:00.000Z", service: "billing", level: "info", count: 1 },
    ]);
  });
});

describe("buildAggregateUpsert", () => {
  it("builds an upsert query with the grouped counts", () => {
    const query = buildAggregateUpsert([
      { bucketStart: "2026-08-03T10:00:00.000Z", service: "checkout", level: "info", count: 3 },
      { bucketStart: "2026-08-03T10:00:00.000Z", service: "billing", level: "error", count: 1 },
    ]);

    expect(query.text).toContain(
      "INSERT INTO public.log_minute_aggregates (bucket_start, service, level, count)"
    );
    expect(query.text).toContain("VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)");
    expect(query.text).toContain("ON CONFLICT (bucket_start, service, level)");
    expect(query.text).toContain(
      "DO UPDATE SET count = public.log_minute_aggregates.count + EXCLUDED.count"
    );
    expect(query.values).toEqual([
      "2026-08-03T10:00:00.000Z",
      "checkout",
      "info",
      3,
      "2026-08-03T10:00:00.000Z",
      "billing",
      "error",
      1,
    ]);
  });

  it("rejects empty groups", () => {
    expect(() => buildAggregateUpsert([])).toThrow(EmptyBulkInsertError);
  });
});

describe("chunkLogEntries", () => {
  it("chunks entries using the configured insert size", () => {
    const entries = Array.from({ length: MAX_LOGS_PER_INSERT + 1 }, (_, index) =>
      createEntry(index)
    );

    const chunks = chunkLogEntries(entries);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(MAX_LOGS_PER_INSERT);
    expect(chunks[1]).toHaveLength(1);
  });
});
