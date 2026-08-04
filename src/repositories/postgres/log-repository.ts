import { pool } from "../../config/database.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import { MissingLogsTableError } from "../../errors/missing-logs-table-error.js";
import type { ILogRepository } from "../interfaces/log-repository.js";
import { buildBulkInsert, chunkLogEntries } from "./log-bulk-insert-query.js";

export class PostgresLogRepository implements ILogRepository {
  async ensureSchemaReady(): Promise<void> {
    const client = await pool.connect();

    try {
      const { rows } = await client.query("SELECT to_regclass('public.logs') AS table_name");

      const tableExists = rows[0]?.table_name === "logs";

      if (!tableExists) {
        throw new MissingLogsTableError();
      }
    } finally {
      client.release();
    }
  }

  async saveLogs(entries: IngestLogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const client = await pool.connect();

    try {
      for (const chunk of chunkLogEntries(entries)) {
        const query = buildBulkInsert(chunk);
        await client.query(query.text, query.values);
      }
    } finally {
      client.release();
    }
  }
}
