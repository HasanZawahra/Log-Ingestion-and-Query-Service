import { pool } from "../../config/database.js";
import { PUBLIC_LOGS_TABLE_NAME } from "../../constants/database.js";
import type { IRetentionRepository } from "../interfaces/retention-repository.js";

export class PostgresRetentionRepository implements IRetentionRepository {
  async deleteExpiredLogs(cutoff: Date, batchSize: number): Promise<number> {
    // Retention uses a direct SQL delete against the logs table.
    const client = await pool.connect();

    try {
      // Build a bounded delete query that removes the oldest rows first.
      const query = buildDeleteExpiredLogsQuery(cutoff, batchSize);
      const result = await client.query(query.text, query.values);
      return result.rowCount ?? 0;
    } finally {
      // Always release the connection back to the pool.
      client.release();
    }
  }
}

function buildDeleteExpiredLogsQuery(
  cutoff: Date,
  batchSize: number
): {
  text: string;
  values: unknown[];
} {
  return {
    // Use CTID to delete the exact rows selected in the CTE.
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
    // The cutoff and batch size are passed as prepared-statement parameters.
    values: [cutoff, batchSize],
  };
}
