import { describe, expect, it } from "vitest";
import {
  validateAttributes,
  validateBatch,
  validateLevel,
  validateLog,
  validateTimestamp,
  normalizeIngestRequest,
} from "../../validation/log-validator.js";

describe("log validation", () => {
  it("accepts a valid batch and rejects invalid entries independently", () => {
    // Use one valid log and one invalid log to verify partial acceptance.
    const now = new Date();
    const validTimestamp = new Date(now.getTime() - 60_000).toISOString();
    const futureTimestamp = new Date(now.getTime() + 10 * 60_000).toISOString();

    const result = validateBatch({
      entries: [
        {
          timestamp: validTimestamp,
          level: "info",
          service: "checkout",
          message: "Created order",
          attributes: { requestId: "abc-123", retries: 1 },
        },
        {
          timestamp: futureTimestamp,
          level: "warn",
          service: "billing",
          message: "",
          attributes: { nested: { value: true } },
        },
      ],
    });

    expect(result.validEntries).toHaveLength(1);
    expect(result.rejectedEntries).toHaveLength(1);
    // The failure reason should include every broken field.
    expect(result.rejectedEntries[0]?.reason).toContain("timestamp");
    expect(result.rejectedEntries[0]?.reason).toContain("message");
    expect(result.rejectedEntries[0]?.reason).toContain("attributes");
  });

  it("validates timestamps and level values", () => {
    // A canonical timestamp should pass unchanged.
    expect(validateTimestamp("2024-01-01T00:00:00Z")).toEqual([]);
    // Malformed timestamps are rejected with a stable message.
    expect(validateTimestamp("not-a-date")).toEqual(["timestamp must be a valid ISO 8601 date"]);
    // Future timestamps are capped so ingest cannot drift too far ahead.
    expect(validateTimestamp(new Date(Date.now() + 10 * 60_000).toISOString())).toEqual([
      "timestamp cannot be more than 5 minutes in the future",
    ]);

    // Only the documented log levels are accepted.
    expect(validateLevel("info")).toEqual([]);
    expect(validateLevel("verbose")).toEqual(["level must be one of: debug, info, warn, error"]);
  });

  it("validates message, service, and attributes structure", () => {
    // A complete, well-formed log entry should produce no validation errors.
    expect(
      validateLog(
        { timestamp: "2024-01-01T00:00:00Z", level: "error", service: "api", message: "ok" },
        0
      )
    ).toEqual([]);
    // Whitespace-only service names are not valid.
    expect(
      validateLog(
        { timestamp: "2024-01-01T00:00:00Z", level: "error", service: "  ", message: "ok" },
        1
      )
    ).toEqual(["service must be a non-empty string"]);

    // Attributes must stay flat and primitive.
    expect(validateAttributes({ ok: true, nested: { value: true } })).toEqual([
      "attributes must be a flat object with primitive values only",
    ]);
    expect(validateAttributes(["bad"])).toEqual([
      "attributes must be a flat object with primitive values only",
    ]);
  });

  it("normalizes common batch envelopes into an ingest request", () => {
    // Different generators use different top-level keys, so we normalize them all.
    const batch = [
      {
        timestamp: "2024-01-01T00:00:00Z",
        level: "info",
        service: "api",
        message: "ok",
      },
    ];

    expect(normalizeIngestRequest({ entries: batch })).toEqual({ entries: batch });
    expect(normalizeIngestRequest({ logs: batch })).toEqual({ entries: batch });
    expect(normalizeIngestRequest({ data: batch })).toEqual({ entries: batch });
    expect(normalizeIngestRequest({ items: batch })).toEqual({ entries: batch });
    expect(normalizeIngestRequest(batch)).toEqual({ entries: batch });
  });
});
