import { pool } from "../../config/database.js";
import { PUBLIC_LOGS_TABLE_NAME } from "../../constants/database.js";
import type { IRetentionRepository } from "../interfaces/retention-repository.js";

export class PostgresRetentionRepository implements IRetentionRepository {
  async deleteExpiredLogs(cutoff: Date, batchSize: number): Promise<number> {
    const client = await pool.connect();

    try {
      const query = buildDeleteExpiredLogsQuery(cutoff, batchSize);
      const result = await client.query(query.text, query.values);
      return result.rowCount ?? 0;
    } finally {
      client.release();
    }
  }
}

function buildDeleteExpiredLogsQuery(cutoff: Date, batchSize: number): {
  text: string;
  values: unknown[];
} {
  return {
    text: [
      "WITH expired AS (",
      `  SELECT ctid`,
      `  FROM ${PUBLIC_LOGS_TABLE_NAME}`,
      "  WHERE timestamp < $1",
      "  ORDER BY timestamp ASC, id ASC",
      "  LIMIT $2",
      ")",
      `DELETE FROM ${PUBLIC_LOGS_TABLE_NAME}`,
      "WHERE ctid IN (SELECT ctid FROM expired)",
    ].join("\n"),
    values: [cutoff, batchSize],
  };
}
