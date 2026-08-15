DROP INDEX "logs_attributes_kv_idx";--> statement-breakpoint
CREATE INDEX "log_minute_aggregates_bucket_start_idx" ON "log_minute_aggregates" USING btree ("bucket_start");--> statement-breakpoint
ANALYZE "logs";--> statement-breakpoint
ANALYZE "log_minute_aggregates";
