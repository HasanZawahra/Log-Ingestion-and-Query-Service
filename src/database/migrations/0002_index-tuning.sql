DROP INDEX "logs_level_timestamp_id_idx";--> statement-breakpoint
CREATE INDEX "logs_service_level_timestamp_id_idx" ON "logs" USING btree ("service","level","timestamp" DESC NULLS LAST,"id" DESC NULLS LAST);
