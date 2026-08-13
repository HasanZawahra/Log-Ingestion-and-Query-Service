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

export const logLevel = pgEnum("log_level", [...LOG_LEVELS]);

export const logs = pgTable(
  LOGS_TABLE_NAME,
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    level: logLevel("level").notNull(),
    service: varchar("service", { length: 255 }).notNull(),
    message: text("message").notNull(),
    attributes: jsonb("attributes")
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => ({
    timestampIdIdx: index("logs_timestamp_id_idx").on(table.timestamp.desc(), table.id.desc()),
    serviceTimestampIdx: index("logs_service_timestamp_id_idx").on(
      table.service,
      table.timestamp.desc(),
      table.id.desc()
    ),
    levelTimestampIdx: index("logs_level_timestamp_id_idx").on(
      table.level,
      table.timestamp.desc(),
      table.id.desc()
    ),
    attributesKvIdx: index("logs_attributes_kv_idx").using(
      "gin",
      sql`logs_attributes_kv(${table.attributes})`
    ),
    messageTrgmIdx: index("logs_message_trgm_idx").using("gin", sql`message gin_trgm_ops`),
  })
);

export const logMinuteAggregates = pgTable(
  LOG_MINUTE_AGGREGATES_TABLE_NAME,
  {
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    service: varchar("service", { length: 255 }).notNull(),
    level: logLevel("level").notNull(),
    count: bigint("count", { mode: "number" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bucketStart, table.service, table.level] }),
    bucketStartIdx: index("log_minute_aggregates_bucket_start_idx").on(table.bucketStart),
    serviceBucketStartIdx: index("log_minute_aggregates_service_bucket_start_idx").on(
      table.service,
      table.bucketStart
    ),
    levelBucketStartIdx: index("log_minute_aggregates_level_bucket_start_idx").on(
      table.level,
      table.bucketStart
    ),
  })
);

export type LogRecord = typeof logs.$inferSelect;
export type NewLogRecord = typeof logs.$inferInsert;
