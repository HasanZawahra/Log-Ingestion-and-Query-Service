import type { IngestLogEntry, IngestRequest } from "../dto/ingest-request.js";
import type { RejectedEntry } from "../dto/ingest-response.js";

const VALID_LEVELS = ["debug", "info", "warn", "error"] as const;

export function isIngestRequest(value: unknown): value is IngestRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Array.isArray((value as { entries?: unknown }).entries);
}

export function validateBatch(request: IngestRequest): {
  validEntries: IngestLogEntry[];
  rejectedEntries: RejectedEntry[];
} {
  const validEntries: IngestLogEntry[] = [];
  const rejectedEntries: RejectedEntry[] = [];

  request.entries.forEach((entry, index) => {
    const errors = validateLog(entry, index);

    if (errors.length === 0) {
      validEntries.push(entry);
      return;
    }

    rejectedEntries.push({
      index,
      reason: errors.join("; "),
      entry,
    });
  });

  return { validEntries, rejectedEntries };
}

export function validateLog(entry: unknown, index: number): string[] {
  const candidate = typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {};

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
    return [];
  }

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return ["attributes must be a flat object with primitive values only"];
  }

  const entries = Object.entries(attributes as Record<string, unknown>);

  for (const [, value] of entries) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      continue;
    }

    return ["attributes must be a flat object with primitive values only"];
  }

  return [];
}

export function validateTimestamp(timestamp: unknown): string[] {
  if (typeof timestamp !== "string") {
    return ["timestamp must be a valid ISO 8601 date"];
  }

  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return ["timestamp must be a valid ISO 8601 date"];
  }

  const currentTime = Date.now();
  const futureThreshold = currentTime + 5 * 60_000;

  if (parsed > futureThreshold) {
    return ["timestamp cannot be more than 5 minutes in the future"];
  }

  return [];
}

export function validateLevel(level: unknown): string[] {
  if (typeof level !== "string" || !VALID_LEVELS.includes(level as (typeof VALID_LEVELS)[number])) {
    return ["level must be one of: debug, info, warn, error"];
  }

  return [];
}

function validateMessage(message: unknown): string[] {
  if (typeof message !== "string" || message.trim().length === 0) {
    return ["message must be a non-empty string"];
  }

  return [];
}

function validateService(service: unknown): string[] {
  if (typeof service !== "string" || service.trim().length === 0) {
    return ["service must be a non-empty string"];
  }

  return [];
}
