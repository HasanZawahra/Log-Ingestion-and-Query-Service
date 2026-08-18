import { LOG_QUERY_CURSOR_ENCODING } from "../constants/log.js";

export interface LogCursor {
  // Original log timestamp used to resume pagination.
  timestamp: string;
  // Deterministic tiebreaker for same-timestamp rows.
  id: number;
}

export function encodeLogCursor(cursor: LogCursor): string {
  // Serialize the cursor payload into a URL-safe string.
  return Buffer.from(JSON.stringify(cursor), "utf8").toString(LOG_QUERY_CURSOR_ENCODING);
}

export function decodeLogCursor(cursor: string): LogCursor | null {
  try {
    // Decode the opaque token back into its JSON representation.
    const json = Buffer.from(cursor, LOG_QUERY_CURSOR_ENCODING).toString("utf8");

    if (encodeLogCursorFromJson(json) !== cursor) {
      // Reject tokens that do not round-trip cleanly.
      return null;
    }

    const parsed = JSON.parse(json) as Record<string, unknown>;

    if (
      // Validate the decoded cursor shape before it reaches SQL.
      typeof parsed.timestamp !== "string" ||
      Number.isNaN(Date.parse(parsed.timestamp)) ||
      typeof parsed.id !== "number" ||
      !Number.isInteger(parsed.id) ||
      parsed.id < 0
    ) {
      return null;
    }

    return {
      timestamp: parsed.timestamp,
      id: parsed.id,
    };
  } catch {
    // Any decoding or parsing failure makes the cursor invalid.
    return null;
  }
}

export function isValidLogCursor(cursor: string): boolean {
  // The cursor is valid only if it can be decoded successfully.
  return decodeLogCursor(cursor) !== null;
}

function encodeLogCursorFromJson(json: string): string {
  // Helper used to verify that the encoded string round-trips correctly.
  return Buffer.from(json, "utf8").toString(LOG_QUERY_CURSOR_ENCODING);
}
