import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { LOG_MINUTE_AGGREGATES_TABLE_NAME, LOGS_TABLE_NAME } from "../constants/database.js";
import { LOG_LEVELS } from "../constants/log.js";

// Match the application-level log severities to the PostgreSQL enum.
export const logLevel = pgEnum("log_level", [...LOG_LEVELS]);

// Store each raw log entry exactly once.
export const logs = pgTable(
  LOGS_TABLE_NAME,
  {
    // Surrogate primary key used for ordering and cursor pagination.
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Preserve the original event timestamp in UTC.
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    // Persist the severity as an enum for compact indexing.
    level: logLevel("level").notNull(),
    // Keep the emitting service name as a short indexed string.
    service: varchar("service", { length: 255 }).notNull(),
    // Store the human-readable message text.
    message: text("message").notNull(),
    // Store arbitrary structured metadata in JSONB.
    attributes: jsonb("attributes")
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => ({
    // Support the default timestamp-descending query order.
    timestampIdIdx: index("logs_timestamp_id_idx").on(table.timestamp.desc(), table.id.desc()),
    // Support service-filtered queries without scanning the whole table.
    serviceTimestampIdx: index("logs_service_timestamp_id_idx").on(
      table.service,
      table.timestamp.desc(),
      table.id.desc()
    ),
    // Support combined service and level filters efficiently.
    serviceLevelTimestampIdx: index("logs_service_level_timestamp_id_idx").on(
      table.service,
      table.level,
      table.timestamp.desc(),
      table.id.desc()
    ),
  })
);

// Maintain a minute-level rollup table for faster aggregate reads.
export const logMinuteAggregates = pgTable(
  LOG_MINUTE_AGGREGATES_TABLE_NAME,
  {
    // Start of the minute bucket in UTC.
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    // Service dimension for the rollup row.
    service: varchar("service", { length: 255 }).notNull(),
    // Severity dimension for the rollup row.
    level: logLevel("level").notNull(),
    // Number of raw logs represented by this bucket/service/level group.
    count: bigint("count", { mode: "number" }).notNull(),
  },
  (table) => ({
    // Keep one aggregate row per minute, service, and level.
    pk: primaryKey({ columns: [table.bucketStart, table.service, table.level] }),
    // Support service-filtered aggregate queries over a time window.
    serviceBucketStartIdx: index("log_minute_aggregates_service_bucket_start_idx").on(
      table.service,
      table.bucketStart
    ),
    // Support level-filtered aggregate queries over a time window.
    levelBucketStartIdx: index("log_minute_aggregates_level_bucket_start_idx").on(
      table.level,
      table.bucketStart
    ),
  })
);

// Export inferred row types for repository code and tests.
export type LogRecord = typeof logs.$inferSelect;
export type NewLogRecord = typeof logs.$inferInsert;
