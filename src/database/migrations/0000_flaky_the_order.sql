CREATE TYPE "public"."log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"level" "log_level" NOT NULL,
	"service" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "logs_timestamp_id_idx" ON "logs" USING btree ("timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logs_service_timestamp_id_idx" ON "logs" USING btree ("service","timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logs_service_level_timestamp_id_idx" ON "logs" USING btree ("service","level","timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logs_level_timestamp_id_idx" ON "logs" USING btree ("level","timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logs_message_trgm_idx" ON "logs" USING gin ("message" gin_trgm_ops);--> statement-breakpoint
CREATE TABLE "log_minute_aggregates" (
	"bucket_start" timestamp with time zone NOT NULL,
	"service" varchar(255) NOT NULL,
	"level" "log_level" NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "log_minute_aggregates_bucket_start_service_level_pk" PRIMARY KEY("bucket_start","service","level")
);
--> statement-breakpoint
CREATE INDEX "log_minute_aggregates_bucket_start_idx" ON "log_minute_aggregates" USING btree ("bucket_start");--> statement-breakpoint
CREATE INDEX "log_minute_aggregates_service_bucket_start_idx" ON "log_minute_aggregates" USING btree ("service","bucket_start");--> statement-breakpoint
CREATE INDEX "log_minute_aggregates_level_bucket_start_idx" ON "log_minute_aggregates" USING btree ("level","bucket_start");
