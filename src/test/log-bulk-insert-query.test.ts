import { describe, expect, it } from "vitest";
import type { IngestLogEntry } from "../dto/ingest-request.js";
import { EmptyBulkInsertError } from "../errors/empty-bulk-insert-error.js";
import { buildBulkInsert, chunkLogEntries, MAX_LOGS_PER_INSERT } from "../repositories/postgres/log-bulk-insert-query.js";

function createEntry(index: number): IngestLogEntry {
  return {
    timestamp: `2026-08-03T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
    level: "info",
    service: "checkout",
    message: `event-${index}`,
  };
}

describe("buildBulkInsert", () => {
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

    const query = buildBulkInsert(entries);

    expect(query.text).toContain("INSERT INTO public.logs (timestamp, level, service, message, attributes)");
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
    expect(() => buildBulkInsert([])).toThrow(EmptyBulkInsertError);
  });
});

describe("chunkLogEntries", () => {
  it("chunks entries using the configured insert size", () => {
    const entries = Array.from({ length: MAX_LOGS_PER_INSERT + 1 }, (_, index) => createEntry(index));

    const chunks = chunkLogEntries(entries);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(MAX_LOGS_PER_INSERT);
    expect(chunks[1]).toHaveLength(1);
  });
});
