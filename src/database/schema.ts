import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { LOGS_TABLE_NAME } from "../constants/database.js";
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
    serviceLevelTimestampIdx: index("logs_service_level_timestamp_id_idx").on(
      table.service,
      table.level,
      table.timestamp.desc(),
      table.id.desc()
    ),
    levelTimestampIdx: index("logs_level_timestamp_id_idx").on(
      table.level,
      table.timestamp.desc(),
      table.id.desc()
    ),
    messageTrgmIdx: index("logs_message_trgm_idx").using("gin", sql`message gin_trgm_ops`),
    attributesIdx: index("logs_attributes_gin_idx").using("gin", table.attributes),
  })
);

export type LogRecord = typeof logs.$inferSelect;
export type NewLogRecord = typeof logs.$inferInsert;
