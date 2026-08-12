import { describe, expect, it } from "vitest";
import { parseLogAggregateRequest } from "../../validation/log-aggregate-validator.js";

describe("log aggregate validation", () => {
  it("parses a valid aggregate query", () => {
    const result = parseLogAggregateRequest({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "5m",
      group_by: "service",
      service: "checkout",
      level: "info",
      q: "payment failed",
      "attr.region": "eu-west",
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
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
  });

  it("rejects invalid timestamps", () => {
    const result = parseLogAggregateRequest({
      since: "not-a-date",
      until: "still-not-a-date",
      bucket: "1m",
    });

    expect(result.value).toBeNull();
    expect(result.errors).toEqual([
      "since must be a valid ISO 8601 date",
      "until must be a valid ISO 8601 date",
    ]);
  });

  it("rejects unsupported bucket values", () => {
    const result = parseLogAggregateRequest({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "10m",
    });

    expect(result.value).toBeNull();
    expect(result.errors).toEqual(["bucket must be one of: 1m, 5m, 1h, 1d"]);
  });

  it("rejects unsupported grouping values", () => {
    const result = parseLogAggregateRequest({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
      group_by: "service_name",
    });

    expect(result.value).toBeNull();
    expect(result.errors).toEqual(["group_by must be one of: service, level"]);
  });

  it("rejects until values that are not greater than since", () => {
    const result = parseLogAggregateRequest({
      since: "2026-08-03T11:00:00.000Z",
      until: "2026-08-03T10:00:00.000Z",
      bucket: "1h",
    });

    expect(result.value).toBeNull();
    expect(result.errors).toEqual(["until must be greater than since"]);
  });

  it("rejects missing required fields", () => {
    const result = parseLogAggregateRequest({
      bucket: "1d",
    });

    expect(result.value).toBeNull();
    expect(result.errors).toEqual([
      "since must be a valid ISO 8601 date",
      "until must be a valid ISO 8601 date",
    ]);
  });

  it("ignores null-like optional aggregate filters", () => {
    const result = parseLogAggregateRequest({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
      group_by: "null",
      service: "undefined",
      level: "null",
      q: "",
      "attr.requestId": "null",
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
    });
  });
});
