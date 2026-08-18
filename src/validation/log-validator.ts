import type { IngestLogEntry, IngestRequest } from "../dto/ingest/ingest-request.js";
import type { RejectedEntry } from "../dto/ingest/ingest-response.js";
import { LOG_LEVELS } from "../constants/log.js";

// A request is valid only if it normalizes into an entries array.
export function isIngestRequest(value: unknown): value is IngestRequest {
  return normalizeIngestRequest(value) !== null;
}

export function normalizeIngestRequest(value: unknown): IngestRequest | null {
  if (Array.isArray(value)) {
    // Accept raw arrays for compatibility with looser clients and tests.
    return { entries: value as IngestLogEntry[] };
  }

  if (typeof value !== "object" || value === null) {
    // Non-object payloads cannot represent an ingest batch.
    return null;
  }

  const payload = value as {
    entries?: unknown;
    logs?: unknown;
    data?: unknown;
    items?: unknown;
  };
  // Support the common top-level keys used by different generators.
  const entries = payload.entries ?? payload.logs ?? payload.data ?? payload.items;

  if (Array.isArray(entries)) {
    // Normalize the accepted payload into the internal request shape.
    return { entries: entries as IngestLogEntry[] };
  }

  // Anything else fails the top-level shape check.
  return null;
}

export function validateBatch(request: IngestRequest): {
  validEntries: IngestLogEntry[];
  rejectedEntries: RejectedEntry[];
} {
  // Collect valid entries and per-item validation failures separately.
  const validEntries: IngestLogEntry[] = [];
  const rejectedEntries: RejectedEntry[] = [];

  request.entries.forEach((entry, index) => {
    // Validate each entry independently so one bad item does not fail the batch.
    const errors = validateLog(entry, index);

    if (errors.length === 0) {
      // Accepted entries can be persisted directly.
      validEntries.push(entry);
      return;
    }

    // Rejected entries keep the reason and original payload for diagnostics.
    rejectedEntries.push({
      index,
      reason: errors.join("; "),
      entry,
    });
  });

  return { validEntries, rejectedEntries };
}

export function validateLog(entry: unknown, index: number): string[] {
  // Coerce non-object payloads to an empty candidate for consistent errors.
  const candidate =
    typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {};

  // Each validator contributes its own rejection reason.
  const errors = [
    ...validateTimestamp((candidate as Partial<IngestLogEntry>).timestamp),
    ...validateLevel((candidate as Partial<IngestLogEntry>).level),
    ...validateMessage((candidate as Partial<IngestLogEntry>).message),
    ...validateService((candidate as Partial<IngestLogEntry>).service),
    ...validateAttributes((candidate as Partial<IngestLogEntry>).attributes),
  ];

  return errors;
}

export function validateAttributes(attributes: unknown): string[] {
  if (attributes === undefined) {
    // Attributes are optional.
    return [];
  }

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    // Only flat objects with primitive values are allowed.
    return ["attributes must be a flat object with primitive values only"];
  }

  // Inspect every attribute value to reject nested structures.
  const entries = Object.entries(attributes as Record<string, unknown>);

  for (const [, value] of entries) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      continue;
    }

    // Any nested object or array makes the whole attribute map invalid.
    return ["attributes must be a flat object with primitive values only"];
  }

  return [];
}

export function validateTimestamp(timestamp: unknown): string[] {
  if (typeof timestamp !== "string") {
    // Timestamps must be serialized strings.
    return ["timestamp must be a valid ISO 8601 date"];
  }

  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    // Reject strings that cannot be parsed as dates.
    return ["timestamp must be a valid ISO 8601 date"];
  }

  const currentTime = Date.now();
  const futureThreshold = currentTime + 5 * 60_000;

  if (parsed > futureThreshold) {
    // The contract caps future timestamps at five minutes ahead.
    return ["timestamp cannot be more than 5 minutes in the future"];
  }

  return [];
}

export function validateLevel(level: unknown): string[] {
  if (typeof level !== "string" || !LOG_LEVELS.includes(level as (typeof LOG_LEVELS)[number])) {
    // Only the four supported severity values are accepted.
    return ["level must be one of: debug, info, warn, error"];
  }

  return [];
}

function validateMessage(message: unknown): string[] {
  if (typeof message !== "string" || message.trim().length === 0) {
    // Messages must be present and contain visible characters.
    return ["message must be a non-empty string"];
  }

  return [];
}

function validateService(service: unknown): string[] {
  if (typeof service !== "string" || service.trim().length === 0) {
    // Service names must be present and contain visible characters.
    return ["service must be a non-empty string"];
  }

  return [];
}
