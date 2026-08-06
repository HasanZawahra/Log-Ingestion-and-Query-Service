import type { IngestLogLevel } from "../dto/ingest/ingest-request.js";
import type { LogQueryRequest } from "../dto/log-query/log-query-request.js";
import { LOG_LEVELS, MAX_LOG_QUERY_LIMIT, MIN_LOG_QUERY_LIMIT } from "../constants/log.js";
import { isValidLogCursor } from "../utils/log-cursor.js";

export interface LogQueryValidationResult {
  value: LogQueryRequest | null;
  errors: string[];
}

export function parseLogQueryRequest(query: unknown): LogQueryValidationResult {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return {
      value: null,
      errors: ["query parameters must be provided as an object"],
    };
  }

  const rawQuery = query as Record<string, unknown>;
  const errors: string[] = [];
  const value: LogQueryRequest = {};
  const attributeFilters: Record<string, string> = {};

  if ("service" in rawQuery) {
    const service = parseStringParam(rawQuery.service);
    if (!service) {
      errors.push("service must be a non-empty string");
    } else {
      value.service = service;
    }
  }

  if ("level" in rawQuery) {
    const level = parseLevelParam(rawQuery.level);
    if (!level) {
      errors.push("level must be one of: debug, info, warn, error");
    } else {
      value.level = level;
    }
  }

  const since = "since" in rawQuery ? parseTimestampParam(rawQuery.since) : null;
  if ("since" in rawQuery) {
    if (!since) {
      errors.push("since must be a valid ISO 8601 date");
    } else {
      value.since = since;
    }
  }

  const until = "until" in rawQuery ? parseTimestampParam(rawQuery.until) : null;
  if ("until" in rawQuery) {
    if (!until) {
      errors.push("until must be a valid ISO 8601 date");
    } else {
      value.until = until;
    }
  }

  if (since && until && Date.parse(until) <= Date.parse(since)) {
    errors.push("until must be greater than since");
  }

  if ("q" in rawQuery) {
    const q = parseStringParam(rawQuery.q, false);
    if (q === null) {
      errors.push("q must be a string");
    } else {
      value.q = q;
    }
  }

  if ("limit" in rawQuery) {
    const limit = parseLimitParam(rawQuery.limit);
    if (limit === null) {
      errors.push(
        `limit must be an integer between ${MIN_LOG_QUERY_LIMIT} and ${MAX_LOG_QUERY_LIMIT}`
      );
    } else {
      value.limit = limit;
    }
  }

  if ("cursor" in rawQuery) {
    const cursor = parseStringParam(rawQuery.cursor, false);
    if (cursor === null || !isValidLogCursor(cursor)) {
      errors.push("cursor must be a valid base64url-encoded log cursor");
    } else {
      value.cursor = cursor;
    }
  }

  for (const [key, rawValue] of Object.entries(rawQuery)) {
    if (!key.startsWith("attr.")) {
      continue;
    }

    const attributeKey = key.slice("attr.".length);
    const attributeValue = parseStringParam(rawValue, false);

    if (attributeKey.length === 0 || attributeValue === null) {
      errors.push(`attribute filter ${key} must be a string`);
      continue;
    }

    attributeFilters[attributeKey] = attributeValue;
  }

  if (Object.keys(attributeFilters).length > 0) {
    value.attributeFilters = attributeFilters;
  }

  return {
    value: errors.length === 0 ? value : null,
    errors,
  };
}

export function validateQueryTimestamp(timestamp: unknown, fieldName: "since" | "until"): string[] {
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) {
    return [`${fieldName} must be a valid ISO 8601 date`];
  }

  return [];
}

export function validateTimeRange(since: unknown, until: unknown): string[] {
  const errors = [
    ...validateQueryTimestamp(since, "since"),
    ...validateQueryTimestamp(until, "until"),
  ];

  if (errors.length > 0) {
    return errors;
  }

  if (Date.parse(until as string) <= Date.parse(since as string)) {
    return ["until must be greater than since"];
  }

  return [];
}

export function validateLogLevel(level: unknown): string[] {
  if (typeof level !== "string" || !LOG_LEVELS.includes(level as IngestLogLevel)) {
    return ["level must be one of: debug, info, warn, error"];
  }

  return [];
}

export function validateLimit(limit: unknown): string[] {
  if (parseLimitParam(limit) === null) {
    return [`limit must be an integer between ${MIN_LOG_QUERY_LIMIT} and ${MAX_LOG_QUERY_LIMIT}`];
  }

  return [];
}

export function validateCursor(cursor: unknown): string[] {
  if (typeof cursor !== "string" || !isValidLogCursor(cursor)) {
    return ["cursor must be a valid base64url-encoded log cursor"];
  }

  return [];
}

function parseStringParam(value: unknown, requireNonEmpty = true): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (requireNonEmpty && value.trim().length === 0) {
    return null;
  }

  return value;
}

function parseLevelParam(value: unknown): IngestLogLevel | null {
  if (typeof value !== "string" || !LOG_LEVELS.includes(value as IngestLogLevel)) {
    return null;
  }

  return value as IngestLogLevel;
}

function parseTimestampParam(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return value;
}

function parseLimitParam(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_LOG_QUERY_LIMIT &&
    value <= MAX_LOG_QUERY_LIMIT
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < MIN_LOG_QUERY_LIMIT || parsed > MAX_LOG_QUERY_LIMIT) {
    return null;
  }

  return parsed;
}
