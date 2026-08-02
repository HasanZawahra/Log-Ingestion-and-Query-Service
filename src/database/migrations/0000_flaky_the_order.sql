CREATE TYPE "public"."log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
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
CREATE INDEX "logs_level_timestamp_id_idx" ON "logs" USING btree ("level","timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "logs_attributes_gin_idx" ON "logs" USING gin ("attributes");