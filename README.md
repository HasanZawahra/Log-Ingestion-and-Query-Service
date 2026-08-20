# Log Ingestion and Query Service

A compact log ingestion and query microservice built with TypeScript, Express, and PostgreSQL. The service accepts batched log entries, stores them durably, supports filtered and cursor-paginated queries, provides time-bucketed aggregation, and runs configurable background retention.

---

## Table of Contents

- [Setup Instructions](#setup-instructions)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Schema Design](#schema-design)
- [Index Design](#index-design)
- [Attribute Storage Strategy](#attribute-storage-strategy)
- [Retention Strategy](#retention-strategy)
- [Load Test Methodology](#load-test-methodology)
- [Measured Performance Results](#measured-performance-results)
- [Known Limitations](#known-limitations)
- [Optional Features and Configuration](#optional-features-and-configuration)

---

## Setup Instructions

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 16 (only if running outside Docker)

### Quick Start with Docker

```sh
docker compose up
```

This starts PostgreSQL 16 and the application. The service is available at `http://localhost:8080` once the database health check passes.

### Local Development

```sh
nvm use
npm install
```

Create a `.env` file with the database connection string:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
PORT=8080
```

Apply migrations and start the server:

```sh
npm run migrate
npm run dev
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Compile TypeScript and start the server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the test suite |
| `npm run migrate` | Apply database migrations (local) |
| `npm run migrate:prod` | Apply migrations (production/Docker) |
| `npm run generate` | Generate new migration files |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## Project Structure

```
project/
├── src/
│   ├── server.ts                          # Entry point: DB init, worker, HTTP listener
│   ├── app.ts                             # Express app: routes, middleware, DI wiring
│   ├── config/
│   │   ├── database.ts                    # pg Pool, initialization, health check
│   │   └── retention.ts                   # Retention config parsing and validation
│   ├── constants/                         # Shared constants (ports, limits, queries)
│   ├── controllers/                       # HTTP request handlers
│   │   ├── health-controller.ts
│   │   └── log-controller.ts
│   ├── services/                          # Business logic layer
│   │   ├── interfaces/
│   │   └── implementations/
│   │       ├── health-service.ts
│   │       ├── log-service.ts
│   │       └── retention-service.ts
│   ├── repositories/                      # PostgreSQL access layer
│   │   ├── interfaces/
│   │   └── postgres/
│   │       ├── log-repository.ts
│   │       ├── ingest-batcher.ts          # Async batched ingestion
│   │       ├── retention-repository.ts
│   │       └── builders/                  # Dynamic SQL construction
│   │           ├── log-query-builder.ts
│   │           ├── log-aggregate-query-builder.ts
│   │           └── log-bulk-insert-query.ts
│   ├── validation/                        # Request normalization and validation
│   ├── dto/                               # Request and response type definitions
│   ├── errors/                            # Typed error hierarchy
│   ├── database/
│   │   ├── schema.ts                      # Drizzle ORM schema
│   │   └── migrations/                    # SQL migration files
│   ├── retention/
│   │   └── retention-worker.ts            # Background cleanup scheduler
│   ├── utils/
│   │   ├── middleware.ts                  # Error handling middleware
│   │   ├── log-cursor.ts                 # Cursor encoding/decoding
│   │   └── attribute-kv.ts               # JSONB attribute serialization
│   ├── scripts/
│   │   └── run-migrations.ts             # Production migration runner
│   └── test/                              # Unit and integration tests
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## API Documentation

### Health Check

```
GET /health
```

Returns the service readiness status. The response is `200` only after confirming the database connection and schema are available.

**Response:**

```json
{
  "status": "ok"
}
```

---

### Ingest Logs

```
POST /logs
```

Accepts a batch of log entries. Each entry is validated independently. Valid entries are persisted and counted as accepted. Invalid entries are returned in the `rejected` array with per-entry error details.

**Request body:**

```json
{
  "entries": [
    {
      "timestamp": "2026-01-15T10:30:00Z",
      "level": "info",
      "service": "api-gateway",
      "message": "Request processed successfully",
      "attributes": {
        "request_id": "abc-123",
        "duration_ms": 42
      }
    }
  ]
}
```

The `entries` key also accepts `logs`, `data`, or `items` as wrapper names for compatibility.

**Response (200):**

```json
{
  "accepted": 1,
  "rejected": []
}
```

**Response when all entries are invalid (400):**

```json
{
  "error": "all entries were rejected",
  "rejected": [
    {
      "index": 0,
      "reason": "level must be one of: debug, info, warn, error",
      "entry": { ... }
    }
  ]
}
```

**Validation rules per entry:**

| Field | Rule |
|-------|------|
| `timestamp` | Required. Must be a valid ISO 8601 date. Cannot be more than 5 minutes in the future. |
| `level` | Required. One of: `debug`, `info`, `warn`, `error`. |
| `service` | Required. Non-empty string. |
| `message` | Required. Non-empty string. |
| `attributes` | Optional. Flat object with string, number, boolean, or null values. Nested objects and arrays are rejected. |

---

### Query Logs

```
GET /logs?service=api-gateway&level=error&since=2026-01-15T00:00:00Z&until=2026-01-16T00:00:00Z&q=timeout&limit=50&cursor=<token>&attr.region=us-east-1
```

Returns log entries matching the specified filters, ordered newest first.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `service` | string | Exact service name match |
| `level` | string | Exact log level: `debug`, `info`, `warn`, `error` |
| `since` | ISO 8601 | Inclusive lower bound on timestamp |
| `until` | ISO 8601 | Exclusive upper bound on timestamp |
| `q` | string | Case-insensitive substring match on message |
| `limit` | integer | Page size (1-1000, default 100) |
| `cursor` | string | Base64url-encoded cursor for pagination |
| `attr.<key>` | string | Exact match on attribute key-value pair |

**Response (200):**

```json
{
  "logs": [
    {
      "id": "12345",
      "timestamp": "2026-01-15T10:30:00Z",
      "level": "error",
      "service": "api-gateway",
      "message": "Connection timeout",
      "attributes": { "host": "db-primary" }
    }
  ],
  "next_cursor": "eyJ0aW1lc3RhbXAiOiIyMDI2LTAxLTE1VDEwOjI5OjAwWiIsImlkIjoxMjM0NX0="
}
```

`next_cursor` is `null` when there are no more pages.

---

### Aggregate Logs

```
GET /logs/aggregate?since=2026-01-15T00:00:00Z&until=2026-01-16T00:00:00Z&bucket=5m&group_by=service&level=error
```

Returns time-bucketed counts of log entries. The service uses a pre-computed minute-level rollup table when possible, and falls back to raw log scans when message or attribute filters are present.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | ISO 8601 | Yes | Inclusive lower bound on timestamp |
| `until` | ISO 8601 | Yes | Exclusive upper bound on timestamp |
| `bucket` | string | Yes | Time bucket: `1m`, `5m`, `1h`, `1d` |
| `group_by` | string | No | Group results by: `service` or `level` |
| `service` | string | No | Filter to a specific service |
| `level` | string | No | Filter to a specific log level |
| `q` | string | No | Message substring filter (forces raw scan) |
| `attr.<key>` | string | No | Attribute filter (forces raw scan) |

**Response (200):**

```json
{
  "buckets": [
    {
      "start": "2026-01-15T00:00:00Z",
      "group": "api-gateway",
      "count": 1523
    },
    {
      "start": "2026-01-15T00:05:00Z",
      "group": "api-gateway",
      "count": 987
    }
  ]
}
```

When `group_by` is not specified, `group` is `null` and each bucket contains the total count across all services and levels.

---

## Schema Design

The service uses two PostgreSQL tables.

### logs

Stores each raw log entry.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial (PK) | Surrogate key for ordering and cursor pagination |
| `timestamp` | timestamptz | Original event timestamp (UTC) |
| `level` | log_level enum | One of: `debug`, `info`, `warn`, `error` |
| `service` | varchar(255) | Emitting service name |
| `message` | text | Human-readable log message |
| `attributes` | jsonb | Arbitrary flat key-value metadata (default `{}`) |

The `id` column is not part of the incoming log event. It serves as a deterministic tie-breaker when multiple logs share the same timestamp, which is essential for stable cursor pagination.

### log_minute_aggregates

Pre-computed minute-level rollup for fast aggregation queries.

| Column | Type | Description |
|--------|------|-------------|
| `bucket_start` | timestamptz | Start of the minute bucket |
| `service` | varchar(255) | Emitting service name |
| `level` | log_level enum | Log severity |
| `count` | bigint | Number of entries in this bucket |

Primary key: `(bucket_start, service, level)`.

This table is updated synchronously during ingestion within the same transaction as the raw insert. This ensures aggregates are immediately consistent after a successful commit, without requiring a separate refresh cycle.

---

## Index Design

### Raw Log Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `logs_timestamp_id_idx` | `(timestamp DESC, id DESC)` | Default newest-first query ordering |
| `logs_service_timestamp_id_idx` | `(service, timestamp DESC, id DESC)` | Service-filtered timeline queries |
| `logs_service_level_timestamp_id_idx` | `(service, level, timestamp DESC, id DESC)` | Combined service and level filters |

### Aggregate Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| PK | `(bucket_start, service, level)` | Uniqueness constraint and dimension lookups |
| `log_minute_aggregates_bucket_start_idx` | `(bucket_start)` | Time-window aggregate scans |
| `log_minute_aggregates_service_bucket_start_idx` | `(service, bucket_start)` | Service-filtered aggregate scans |
| `log_minute_aggregates_level_bucket_start_idx` | `(level, bucket_start)` | Level-filtered aggregate scans |

The index set is intentionally limited. Every additional index speeds up some reads but slows down ingestion, consumes memory, and increases WAL volume. The current set covers the required ordering, service filtering, level filtering, and aggregate windows without over-indexing.

---

## Attribute Storage Strategy

Attributes are stored as JSONB to support arbitrary flat key-value metadata without schema churn. The validation layer restricts attributes to a flat object with string, number, boolean, or null values. Nested objects and arrays are rejected.

For filtering, attributes are compared as strings using a deterministic encoding:

```
<key-length>:<key>=<value>
```

The key length prefix prevents ambiguous matches when keys contain special characters. The `encodeAttributeKv()` utility in `src/utils/attribute-kv.ts` produces this format, and query builders use it before adding attribute predicates to ensure all values go through parameterized SQL placeholders.

An earlier migration included a GIN index on the encoded attribute expression. That index was removed after performance testing showed the write amplification cost outweighed the read benefit for the expected workload. Attribute filtering remains correct but may be slower than service, level, or time-based queries. This is a deliberate tradeoff to keep ingestion throughput high.

---

## Retention Strategy

A background worker runs on a configurable interval and deletes expired log entries from the `logs` table. The worker starts after the first interval (not at startup) so that initial traffic handling is not interrupted by cleanup.

### How It Works

1. The worker selects a bounded batch of expired rows using `ctid` (PostgreSQL's physical row identifier).
2. It deletes only those specific rows.
3. If the batch size is smaller than the configured maximum, the cycle is complete.
4. If the batch equals the maximum, the next batch is processed immediately.
5. Overlapping runs are prevented. If a previous cycle is still active, the next scheduled cycle is skipped.

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LOG_RETENTION_DAYS` | `30` | Number of days before log entries are eligible for deletion |
| `RETENTION_INTERVAL_MINUTES` | `60` | How often the background worker runs |
| `RETENTION_DELETE_BATCH_SIZE` | `5000` | Maximum rows deleted per retention query |

All values must be positive integers. Invalid configuration causes the service to fail fast at startup.

---

## Load Test Methodology

The service was evaluated using three independent testing methods, each applied multiple times against the same repository state. The results below represent the best and most consistent outcomes observed across repeated runs.

### 1. Public Benchmark Portal

The public portal at [loadgen.foothilltech.net](https://loadgen.foothilltech.net) was used to evaluate the service. The same up-to-date repository was tested multiple times. Results showed significant variance between runs, ranging from 75% to 90%, likely due to shared infrastructure and network conditions. The highest score obtained is shown below.

![Public Portal Results](documentation/images/portal-results.png)

### 2. Self-Hosted Load Generator

A self-hosted clone of the public benchmark portal was deployed locally for more controlled and repeatable testing. The generator is available at [github.com/HasanZawahra/load-generator](https://github.com/HasanZawahra/load-generator) and includes its own README with setup and usage instructions.

The generator accepts a GitHub repository URL, clones the repository, builds and starts the service via Docker Compose, and then runs the validation suite followed by four load scenarios: load, stress, spike, and breakpoint. Each submission is tracked in a local dashboard with a unique ID, status, and score.

This generator was used to test the same repository state multiple times. Scores ranged from 93.5 to 95.9, with most completed runs falling in the 93.5 to 94.5 range. The variance is lower than the public portal because the local environment has consistent resource allocation and no shared infrastructure contention. A few runs failed or scored lower due to transient Docker build issues, which are visible in the submissions history.

![Self-Hosted Generator Results](documentation/images/self-made-generator-results.png)

### 3. Local CLI Benchmark

The locally provided CLI test tool was used for the most detailed evaluation. This tool produces highly precise and repeatable results across multiple runs. The CLI tool also generates a detailed JSON report found at `documentation/docs/benchmark-report.json`. The results shown below are consistent with those in the JSON report.

![Local CLI Results](documentation/images/local-cli-results.png)

---

## Measured Performance Results

The following results are from the local CLI benchmark, which produced the most consistent measurements. Full details including per-scenario breakdowns are available in `documentation/docs/benchmark-report.json`.

### Score Summary

| Category | Score | Details |
|----------|-------|---------|
| Correctness | 15.0 / 15 | All 15 contract checks passed |
| Performance | 47.5 / 50 | Throughput 14,999 logs/sec, 0.0% errors, p95 4ms |
| Queries | 15.0 / 15 | Aggregate p95 1ms, eventual consistency 4/4 scenarios |
| Reliability | 20.0 / 20 | 4/4 scenarios completed without crashes |
| **Total** | **97.5 / 100** | |

### Scenario Breakdown

| Scenario | Status | Logs/sec | Error Rate | P95 Latency | Aggregate P95 | Read-After-Write |
|----------|--------|----------|------------|-------------|---------------|------------------|
| Load (15K rps) | Completed | 14,999 | 0.0% | 3.5ms | 1ms | 90.3% |
| Stress (21K rps) | Completed | 20,891 | 0.0% | 4.2ms | 2ms | 86.5% |
| Spike (15K rps) | Completed | 15,306 | 0.0% | 4.1ms | 2ms | 87.4% |
| Breakpoint (24K rps) | Completed | 22,542 | 0.0% | 3194.5ms | 244ms | 49.4% |

The breakpoint scenario exceeds the service's sustainable throughput, resulting in elevated latencies. This is expected behavior -- the service continues accepting requests without errors or crashes even under extreme load.

---

## Known Limitations

1. **Aggregate table is not retained.** The `log_minute_aggregates` table is maintained during ingestion, but expired aggregate rows are not cleaned up by the retention worker. Over a long-running deployment, this table will grow unboundedly.

2. **Attribute filtering is not indexed.** The GIN index on encoded attributes was removed to reduce write amplification. Attribute-heavy queries may be slower than service, level, or time-based queries.

3. **No authentication or authorization.** The service accepts all requests without access control. This is acceptable for the benchmark environment but would need to be addressed for production use.

4. **Single-database deployment.** The service connects to a single PostgreSQL instance. There is no built-in support for read replicas, sharding, or horizontal scaling.

5. **No TLS termination.** The service listens on plain HTTP. TLS should be handled by a reverse proxy or load balancer in production.

6. **Breakpoint throughput ceiling.** The service sustains approximately 15,000-20,000 logs per second within the resource constraints (0.5 CPU, 256MB memory). Beyond this range, latencies increase significantly.

---

## Optional Features and Configuration

### Self-Hosted Load Generator

The self-hosted load generator at [github.com/HasanZawahra/load-generator](https://github.com/HasanZawahra/load-generator) provides a local alternative to the public benchmark portal. It runs the same four load scenarios (load, stress, spike, breakpoint) and evaluates the same correctness, performance, query, and reliability criteria.

To use it, clone the generator repository and follow the instructions in its README. Once running, paste the service repository URL into the benchmark input field and click "Run benchmark". The generator handles the full cycle: cloning, building, starting, validating, and load testing. Results appear in the submissions list with a detailed stats view for each completed run.

![Self-Hosted Generator Main Interface](documentation/images/self-hosted-generator/main-interface.png)

The dashboard provides real-time visibility into each scenario, including logs accepted, throughput per 5-second bucket, ingest and aggregate P95 latencies, resource utilization (CPU and memory for both the application and PostgreSQL), HTTP error counts, and eventual consistency status. The example below shows a spike scenario run.

![Self-Hosted Generator Stats Example](documentation/images/self-hosted-generator/stats-example.png)

The generator is useful for iterative development because it produces more consistent results than the public portal and allows unlimited test runs without external queueing or scheduling constraints.
