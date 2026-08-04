import { LOG_QUERY_CURSOR_ENCODING } from "../constants/log.js";

export interface LogCursor {
  timestamp: string;
  id: number;
}

export function encodeLogCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString(LOG_QUERY_CURSOR_ENCODING);
}

export function decodeLogCursor(cursor: string): LogCursor | null {
  try {
    const json = Buffer.from(cursor, LOG_QUERY_CURSOR_ENCODING).toString("utf8");

    if (encodeLogCursorFromJson(json) !== cursor) {
      return null;
    }

    const parsed = JSON.parse(json) as Record<string, unknown>;

    if (
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
    return null;
  }
}

export function isValidLogCursor(cursor: string): boolean {
  return decodeLogCursor(cursor) !== null;
}

function encodeLogCursorFromJson(json: string): string {
  return Buffer.from(json, "utf8").toString(LOG_QUERY_CURSOR_ENCODING);
}
