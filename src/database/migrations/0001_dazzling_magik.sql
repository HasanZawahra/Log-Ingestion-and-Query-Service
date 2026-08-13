CREATE OR REPLACE FUNCTION "public"."logs_attributes_kv"(a jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$fn$
  SELECT array_agg(length(k)::text || ':' || k || '=' || v ORDER BY k)
  FROM LATERAL jsonb_each_text(a) AS kv(k, v)
$fn$;
--> statement-breakpoint
CREATE INDEX "logs_attributes_kv_idx" ON "logs" USING gin (logs_attributes_kv("attributes"));--> statement-breakpoint
DROP INDEX "logs_service_level_timestamp_id_idx";--> statement-breakpoint
ANALYZE "logs";
--> statement-breakpoint
ANALYZE "log_minute_aggregates";