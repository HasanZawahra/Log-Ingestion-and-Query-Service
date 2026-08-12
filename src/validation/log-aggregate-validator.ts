import type { IngestLogLevel } from "../dto/ingest/ingest-request.js";
import type {
  LogAggregateBucket,
  LogAggregateGroupBy,
  LogAggregateRequest,
} from "../dto/log-aggregate/log-aggregate-request.js";
import { LOG_LEVELS } from "../constants/log.js";
import {
  LOG_AGGREGATE_BUCKETS,
  LOG_AGGREGATE_GROUP_BY_VALUES,
} from "../constants/log-aggregate.js";

export interface LogAggregateValidationResult {
  value: LogAggregateRequest | null;
  errors: string[];
}

export function parseLogAggregateRequest(query: unknown): LogAggregateValidationResult {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return {
      value: null,
      errors: ["query parameters must be provided as an object"],
    };
  }

  const rawQuery = query as Record<string, unknown>;
  const errors: string[] = [];
  const value = {} as Partial<LogAggregateRequest>;
  const attributeFilters: Record<string, string> = {};

  const since = parseRequiredTimestampParam(rawQuery.since, "since", errors);
  const until = parseRequiredTimestampParam(rawQuery.until, "until", errors);

  if (since) {
    value.since = since;
  }

  if (until) {
    value.until = until;
  }

  if (since && until && Date.parse(until) <= Date.parse(since)) {
    errors.push("until must be greater than since");
  }

  if (!("bucket" in rawQuery)) {
    errors.push("bucket is required");
  } else {
    const bucket = parseEnumParam(rawQuery.bucket, LOG_AGGREGATE_BUCKETS);
    if (!bucket) {
      errors.push("bucket must be one of: 1m, 5m, 1h, 1d");
    } else {
      value.bucket = bucket;
    }
  }

  if ("group_by" in rawQuery) {
    const groupBy = parseEnumParam(rawQuery.group_by, LOG_AGGREGATE_GROUP_BY_VALUES);
    if (!groupBy) {
      if (!isAbsentQueryValue(rawQuery.group_by)) {
        errors.push("group_by must be one of: service, level");
      }
    } else {
      value.groupBy = groupBy;
    }
  }

  if ("service" in rawQuery) {
    const service = parseStringParam(rawQuery.service);
    if (service === null) {
      errors.push("service must be a non-empty string");
    } else if (!isAbsentQueryValue(service)) {
      value.service = service;
    }
  }

  if ("level" in rawQuery) {
    const level = parseLevelParam(rawQuery.level);
    if (!level) {
      if (!isAbsentQueryValue(rawQuery.level)) {
        errors.push("level must be one of: debug, info, warn, error");
      }
    } else {
      value.level = level;
    }
  }

  if ("q" in rawQuery) {
    const q = parseStringParam(rawQuery.q, false);
    if (q === null) {
      errors.push("q must be a string");
    } else if (!isAbsentQueryValue(q)) {
      value.q = q;
    }
  }

  for (const [key, rawValue] of Object.entries(rawQuery)) {
    if (!key.startsWith("attr.")) {
      continue;
    }

    const attributeKey = key.slice("attr.".length);
    const attributeValue = parseStringParam(rawValue, false);

    if (attributeKey.length === 0) {
      errors.push(`attribute filter ${key} must be a string`);
      continue;
    }

    if (attributeValue === null || isAbsentQueryValue(attributeValue)) {
      continue;
    }

    attributeFilters[attributeKey] = attributeValue;
  }

  if (Object.keys(attributeFilters).length > 0) {
    value.attributeFilters = attributeFilters;
  }

  return {
    value: errors.length === 0 ? (value as LogAggregateRequest) : null,
    errors,
  };
}

function parseRequiredTimestampParam(
  value: unknown,
  fieldName: "since" | "until",
  errors: string[]
): string | null {
  const timestamp = parseTimestampParam(value);

  if (!timestamp) {
    errors.push(`${fieldName} must be a valid ISO 8601 date`);
    return null;
  }

  return timestamp;
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

function parseEnumParam<T extends string>(value: unknown, options: readonly T[]): T | null {
  if (typeof value !== "string" || !options.includes(value as T)) {
    return null;
  }

  return value as T;
}

function isAbsentQueryValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "null" || normalized === "undefined";
}
