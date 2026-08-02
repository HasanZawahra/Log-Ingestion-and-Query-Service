import { pool } from "../../config/database.js";

export class PostgresLogRepository {
  async ensureSchemaReady(): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("SELECT 1");

      const { rows } = await client.query(
        "SELECT to_regclass('public.logs') AS table_name",
      );

      const tableExists = rows[0]?.table_name === "logs";

      if (!tableExists) {
        throw new Error("required table 'public.logs' is not available");
      }
    } finally {
      client.release();
    }
  }
}
