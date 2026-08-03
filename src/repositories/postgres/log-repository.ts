import { pool } from "../../config/database.js";
import type { IngestLogEntry } from "../../dto/ingest-request.js";
import type { ILogRepository } from "../interfaces/log-repository.js";

export class PostgresLogRepository implements ILogRepository {
  async ensureSchemaReady(): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("SELECT 1");

      const { rows } = await client.query("SELECT to_regclass('public.logs') AS table_name");

      const tableExists = rows[0]?.table_name === "logs";

      if (!tableExists) {
        throw new Error("required table 'public.logs' is not available");
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
      const values = entries.flatMap((entry) => [
        entry.timestamp,
        entry.level,
        entry.service,
        entry.message,
        entry.attributes ?? {},
      ]);

      const valuePlaceholders = entries
        .map((_, index) => {
          const offset = index * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        })
        .join(", ");

      await client.query(
        `
          INSERT INTO public.logs (timestamp, level, service, message, attributes)
          VALUES ${valuePlaceholders}
        `,
        values
      );
    } finally {
      client.release();
    }
  }
}
