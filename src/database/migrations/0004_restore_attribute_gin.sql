CREATE INDEX "logs_attributes_kv_idx" ON "logs" USING gin (logs_attributes_kv("attributes"));--> statement-breakpoint
DROP INDEX "log_minute_aggregates_bucket_start_idx";--> statement-breakpoint
ANALYZE "logs";--> statement-breakpoint
ANALYZE "log_minute_aggregates";