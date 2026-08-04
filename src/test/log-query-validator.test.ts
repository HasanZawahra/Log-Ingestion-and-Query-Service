import { describe, expect, it } from "vitest";
import {
  decodeLogCursor,
  encodeLogCursor,
  isValidLogCursor,
  parseLogQueryRequest,
  validateCursor,
  validateLimit,
  validateLogLevel,
  validateQueryTimestamp,
  validateTimeRange,
} from "../validation/log-query-validator.js";

describe("log query validation", () => {
  it("parses a valid query with combined filters", () => {
    const since = "2026-08-03T10:00:00.000Z";
    const until = "2026-08-03T11:00:00.000Z";
    const cursor = encodeLogCursor({
      timestamp: since,
      id: 42,
    });

    const result = parseLogQueryRequest({
      service: "checkout",
      level: "info",
      since,
      until,
      q: "payment failed",
      limit: "25",
      cursor,
      "attr.requestId": "req-123",
      "attr.region": "eu-west",
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      service: "checkout",
      level: "info",
      since,
      until,
      q: "payment failed",
      limit: 25,
      cursor,
      attributeFilters: {
        requestId: "req-123",
        region: "eu-west",
      },
    });
    expect(decodeLogCursor(cursor)).toEqual({
      timestamp: since,
      id: 42,
    });
    expect(isValidLogCursor(cursor)).toBe(true);
  });

  it("validates timestamps and requires until to be greater than since", () => {
    const since = "2026-08-03T10:00:00.000Z";
    const until = "2026-08-03T09:59:59.000Z";

    expect(validateQueryTimestamp(since, "since")).toEqual([]);
    expect(validateQueryTimestamp("not-a-date", "since")).toEqual([
      "since must be a valid ISO 8601 date",
    ]);
    expect(validateTimeRange(since, until)).toEqual(["until must be greater than since"]);
  });

  it("validates supported log levels and limit range", () => {
    expect(validateLogLevel("warn")).toEqual([]);
    expect(validateLogLevel("verbose")).toEqual([
      "level must be one of: debug, info, warn, error",
    ]);

    expect(validateLimit("1")).toEqual([]);
    expect(validateLimit("1000")).toEqual([]);
    expect(validateLimit("0")).toEqual([
      "limit must be an integer between 1 and 1000",
    ]);
    expect(validateLimit("1001")).toEqual([
      "limit must be an integer between 1 and 1000",
    ]);
  });

  it("validates cursor format", () => {
    const cursor = encodeLogCursor({
      timestamp: "2026-08-03T10:00:00.000Z",
      id: 7,
    });

    expect(validateCursor(cursor)).toEqual([]);
    expect(validateCursor("not-a-cursor")).toEqual([
      "cursor must be a valid base64url-encoded log cursor",
    ]);
  });
});
