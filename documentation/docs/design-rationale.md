# Design Rationale

## Purpose

This service is designed as a compact log ingestion and query system, similar in spirit to a small Datadog or Grafana Loki backend. The core requirement is not only to accept and return logs correctly, but to keep doing so under constrained resources and while the database contains around one million records.

The design therefore favors a few practical principles:

- Keep the public API contract exact and predictable.
- Validate requests before they reach persistence code.
- Write logs in bulk instead of one row at a time.
- Keep PostgreSQL as the source of truth for both raw logs and aggregate data.
- Shape indexes and query plans around the required access patterns.
- Isolate dynamic SQL construction so it stays testable and parameterized.
- Use small, explicit layers instead of a large framework.
- Document non-obvious decisions directly in code comments.

## Requirements Acknowledgement

The implementation is built around the requirements in `documentation/docs/software-reqs.pdf`.

The required contract includes:

- `GET /health` for readiness.
- `POST /logs` for batched ingestion.
- `GET /logs` for filtered, cursor-paginated log search.
- `GET /logs/aggregate` for time-bucketed counts.
- Per-entry validation for ingest batches.
- Freely combinable filters for service, level, time range, attributes, and message text.
- Deterministic newest-first ordering for log queries.
- Cursor-based pagination.
- Configurable retention of expired logs.
- A plain `docker compose up` startup path with PostgreSQL as the durable store.

The implementation treats these requirements as the stable external boundary. Internal choices may evolve, but the required endpoints, status codes, and response shapes are kept as the primary compatibility target.

## High-Level Architecture

The service is organized into small layers:

- `src/app.ts` wires the Express application, middleware, controllers, services, and repositories.
- `src/controllers/*` translate HTTP requests into service calls and send JSON responses.
- `src/services/*` contain business flow: validation, rejection behavior, and delegation to persistence.
- `src/validation/*` normalize and validate request input.
- `src/repositories/*` own PostgreSQL access and convert rows into response DTOs.
- `src/repositories/postgres/builders/*` generate SQL for inserts, queries, and aggregates.
- `src/database/*` defines the schema and migrations.
- `src/retention/*` runs background cleanup.
- `src/errors/*` defines typed application errors and consistent HTTP responses.

This separation keeps HTTP-specific concerns away from SQL-specific concerns. For example, controllers do not construct SQL, and query builders do not know about Express. That makes the service easier to test because each layer has a narrow responsibility.

## External Libraries and Why They Are Used

The project intentionally uses a small set of external libraries. The goal is to keep the runtime simple while relying on proven tools for HTTP handling, PostgreSQL access, migrations, configuration, testing, and code quality.

### Runtime Libraries

`express` provides the HTTP server and routing layer. It helps meet the required API contract by making the four required endpoints explicit in `src/app.ts`: `GET /health`, `POST /logs`, `GET /logs`, and `GET /logs/aggregate`. Its JSON middleware also gives the service a standard request parsing path, which is then wrapped by project-specific error handling for malformed JSON responses.

`pg` is the PostgreSQL driver used by the repository layer. It provides connection pooling, parameterized queries, transactions, and direct SQL execution. This is important for the performance and security requirements: ingestion can reuse pooled connections, write raw logs and rollups in a single transaction, and pass user-controlled values as query parameters instead of interpolating them into SQL.

`drizzle-orm` and `drizzle-kit` are used for schema definition and migrations. The schema in `src/database/schema.ts` documents the tables, columns, indexes, enum types, and rollup table in TypeScript. The migration files then make those decisions reproducible in Docker and CI. This supports the requirement that the system starts cleanly with `docker compose up` and that migrations are applied before the app reports readiness.

`dotenv` loads environment variables during local development. It supports the configuration model used by database startup and retention settings while still allowing Docker Compose and CI to provide environment variables directly.

`tsx` runs TypeScript scripts without requiring a separate manual compilation step. The production migration command uses it to execute `src/scripts/run-migrations.ts` before the compiled server starts.

`postgres` is present as a dependency alongside `pg`. The active repository implementation uses `pg`, while Drizzle tooling commonly works with PostgreSQL connection packages during schema and migration workflows.


### Development and Verification Libraries

`typescript` provides static typing across DTOs, services, repositories, validators, and query builders. This helps keep the API shapes and internal contracts consistent, which matters because the evaluator expects exact request and response structures.

`vitest` is the test runner. It supports the unit and integration tests that verify validation behavior, controller/service boundaries, SQL builder output, batching behavior, retention behavior, and app wiring.

`supertest` allows endpoint tests to exercise the Express app without needing a live external HTTP server. This makes API contract checks fast and repeatable in CI.

`eslint`, `@eslint/js`, and `eslint-config-prettier` enforce code quality rules while staying compatible with Prettier formatting. This helps maintain readable TypeScript and avoid accidental patterns that make the service harder to review.

`prettier` keeps code and documentation formatting consistent. This does not affect runtime behavior directly, but it improves maintainability and reduces noisy diffs on the documentation branch.

The `@types/*` packages provide TypeScript definitions for Node.js, Express, PostgreSQL, and Supertest. They make the runtime library usage type-safe and reduce mistakes in request handling, database access, and tests.

## API and Validation Philosophy

The API layer is intentionally conservative. It accepts the required contract, normalizes a few common batch shapes, and rejects invalid input before it reaches the database.

Ingestion validation happens per entry. A single invalid log does not poison the whole batch. The service collects valid entries, persists only those entries, and returns index-specific rejection details for invalid ones. If every entry is rejected, the service returns a `400`, matching the contract.

Query validation is centralized in `src/validation/log-query-validator.ts` and `src/validation/log-aggregate-validator.ts`. This keeps validation rules close to each other and prevents the repository layer from having to guess whether a request is safe. Invalid timestamps, unsupported levels, inverted time ranges, malformed cursors, invalid limits, and invalid aggregation parameters all become structured bad requests.

The validators also treat empty, `null`, and `undefined` query-string values as absent in several optional fields. That is a compatibility choice for load generators and clients that may send empty parameters while building URLs.

## Data Model

The primary table is `logs`.

Each row stores:

- a generated `bigserial` id,
- the original event timestamp,
- a constrained log level enum,
- the service name,
- the message,
- arbitrary attributes as JSONB.

The generated id is not part of the incoming log event, but it is important internally. It gives the system a deterministic tie-breaker when multiple logs share the same timestamp. This is required for stable sorting and cursor pagination.

The service also maintains `log_minute_aggregates`, a minute-level rollup table keyed by:

- bucket start,
- service,
- level.

This table stores counts that can be reused for common aggregate queries without scanning the full raw log table.

## Attribute Storage Strategy

Attributes are stored as JSONB because the project requires arbitrary flat key/value metadata. JSONB keeps ingestion simple and avoids schema churn when different services emit different attributes.

The validation layer limits attributes to a flat object with string, number, boolean, or null-like JSON values. Nested objects and arrays are rejected because the API contract disallows them, and because flat attributes are easier to compare consistently.

Attribute filters are compared as strings. To make this deterministic, `logs_attributes_kv(attributes)` converts a JSONB object into encoded text entries shaped like:

```text
<key-length>:<key>=<value>
```

The key length prevents ambiguous matches when keys contain unusual characters. Query builders use `encodeAttributeKv()` before adding an attribute predicate, so caller input still goes through parameterized SQL placeholders.

Earlier migrations experimented with a GIN index on this expression. The final migration drops that index after performance tuning. The current posture is that attribute filtering remains correct and safe, but attribute-heavy queries may be more expensive than service/time/level queries. This is an explicit tradeoff to avoid paying unnecessary write-amplification cost on the hot ingestion path unless measurements justify restoring the index.

## Index Design

The main raw-log indexes are aligned with required query ordering and common filters:

- `logs_timestamp_id_idx` supports the default newest-first query order.
- `logs_service_timestamp_id_idx` supports service-filtered timeline queries.
- `logs_service_level_timestamp_id_idx` supports combined service and level filters.

The aggregate table indexes support rollup reads:

- the primary key on bucket, service, and level keeps each minute/dimension row unique.
- `log_minute_aggregates_bucket_start_idx` supports time-window aggregate scans.
- `log_minute_aggregates_service_bucket_start_idx` supports service-filtered aggregate scans.
- `log_minute_aggregates_level_bucket_start_idx` supports level-filtered aggregate scans.

The design intentionally avoids indexing every possible filter combination. Every additional index speeds up some reads but slows down ingestion, consumes memory, and increases WAL volume. Under the project limits, the better default is a small set of indexes that match the most important paths.

## Ingestion Path

The ingestion path is optimized around reducing database round trips.

The flow is:

1. Express parses the JSON body.
2. The controller normalizes the request into an internal batch shape.
3. The service validates each entry independently.
4. Valid entries are queued in the `IngestBatcher`.
5. The batcher combines nearby requests into larger flushes.
6. A PostgreSQL transaction inserts raw rows and upserts minute aggregates together.

`MAX_LOGS_PER_INSERT` is set to `4000`, which is large enough to reduce round trips while keeping generated SQL statements within practical parameter limits. Very large batches are split into chunks before insertion.

The raw insert and aggregate upsert happen in the same transaction. This makes the rollup table consistent with durable raw logs: a batch is either fully represented in both tables or not committed.

The batcher allows a small number of concurrent flushes. This helps absorb HTTP-level concurrency without creating unlimited database pressure.

## Query Path

`GET /logs` uses dynamic SQL built by `PostgresLogQueryBuilder`.

The builder adds only the clauses requested by the caller:

- exact service match,
- exact level match,
- inclusive `since`,
- exclusive `until`,
- case-insensitive message substring,
- string-based attribute equality,
- cursor continuation.

All external values are passed through SQL parameters. Dynamic SQL is limited to known column names, known table names, known ordering expressions, and generated placeholder positions.

Results are sorted by:

```sql
timestamp DESC, id DESC
```

This satisfies the newest-first requirement and stays deterministic when many logs share a timestamp.

Pagination uses keyset pagination instead of offset pagination. The cursor stores the last visible row's timestamp and id. The next page adds:

```sql
(timestamp, id) < ($timestamp, $id)
```

This avoids the performance and correctness problems of offset pagination on a table that is actively receiving new rows.

The repository fetches one extra row beyond the requested page size. If the extra row exists, it returns a `next_cursor`; otherwise `next_cursor` is `null`.

## Aggregation Path

`GET /logs/aggregate` supports time buckets of `1m`, `5m`, `1h`, and `1d`, with optional grouping by service or level.

The query builder has two paths:

- Use `log_minute_aggregates` when the request can be answered from rollups.
- Use the raw `logs` table when the request includes message search or attribute filters.

The rollup path is the preferred fast path. A one-hour or one-day aggregate can be derived by summing minute-level rows instead of scanning every raw log. This is especially important for the p95 aggregation latency target.

The raw path is still necessary because message substring and arbitrary attribute filters are not represented in the rollup table. In those cases, the service prioritizes correctness and computes the requested aggregate directly from raw logs.

Both paths use PostgreSQL `date_bin` so bucket boundaries stay consistent and are calculated by the database.

## Retention Strategy

Retention is handled by a background worker started after database initialization.

Configuration is environment-driven:

- `LOG_RETENTION_DAYS`, default `30`
- `RETENTION_INTERVAL_MINUTES`, default `60`
- `RETENTION_DELETE_BATCH_SIZE`, default `5000`

Invalid retention configuration fails fast because an unsafe cleanup configuration could either delete too much or fail silently.

Deletes are bounded. The repository selects only a limited number of expired rows, then deletes those exact rows using their `ctid`. This avoids one large delete from holding locks for too long or creating a disruptive retention cycle.

The worker also prevents overlapping runs. If a previous retention cycle is still active, the next scheduled cycle is skipped and logged. That keeps cleanup from stacking up under load.

One limitation is that retention currently deletes expired rows from the raw `logs` table. The minute aggregate table is maintained during ingestion, but expired aggregate rows are not cleaned in the same retention path. That keeps raw storage bounded, but aggregate retention should be tightened before a long-running production deployment.

## Startup and Readiness

The Docker image runs migrations before starting the compiled server:

```sh
npm run migrate:prod && node dist/server.js
```

The app does not report healthy until it can connect to PostgreSQL and confirm that the `logs` table exists. This protects the load generator from starting before the service is actually ready to accept logs.

`docker-compose.yml` exposes the service on `localhost:8080`, applies the requested resource limits, waits for PostgreSQL readiness before starting the app, and tunes PostgreSQL for the constrained write-heavy workload.

## Error Handling

The project uses typed `AppError` subclasses for expected failures. Middleware converts those errors into consistent JSON responses while unexpected failures become a generic `500`.

This keeps error behavior predictable without spreading response-format logic through controllers and services.

Examples include:

- malformed JSON,
- invalid top-level ingest bodies,
- all entries rejected,
- invalid log query parameters,
- invalid aggregate query parameters,
- malformed cursors,
- missing database configuration,
- missing database schema.

## Code Commenting Approach

Explaining comments have been added across the workspace to make the implementation easier to review.

The comments focus on why a piece of code exists or what contract it protects. They are especially common around:

- API contract boundaries,
- validation decisions,
- SQL builder behavior,
- cursor pagination,
- ingestion batching,
- transaction boundaries,
- retention scheduling,
- database readiness,
- Docker and CI setup.

The goal is not to narrate every line of TypeScript. The goal is to make the non-obvious choices visible to a reviewer who needs to understand the system quickly.

## Testing Strategy

The test suite is split across unit-style and integration-style coverage.

Repository and builder tests verify SQL construction, batching, pagination behavior, aggregate query selection, and retention delete flow. Service and controller tests verify that validation, response behavior, and error propagation match the contract. Integration tests cover app wiring, route registration, startup and shutdown behavior, database initialization, retention lifecycle, and endpoint behavior.

CI installs dependencies, applies migrations against PostgreSQL, builds TypeScript, runs tests, and runs linting. This gives coverage over both the application code and the schema/migration path that Docker startup relies on.

## Main Tradeoffs

The most important tradeoff is between ingestion speed and secondary read indexes. Extra indexes can improve niche queries, but they slow down every ingest and increase write pressure. The current schema keeps the index set focused on required ordering, service filtering, level filtering, and aggregate windows.

The second tradeoff is rollup freshness versus write cost. Updating minute aggregates synchronously with raw inserts makes aggregate reads fast and immediately consistent after commit. It also adds work to the ingest transaction. This is acceptable here because aggregate latency is a first-class requirement, and the rollup rows are compact compared with raw logs.

The third tradeoff is API compatibility versus strictness. The ingest normalizer accepts a few batch wrapper names in addition to the required `logs` shape. That is additive and does not change the required contract, but it makes the service more tolerant of simple clients and tests.

## Summary

The design is intentionally direct: Express at the edge, TypeScript validation and typed service boundaries in the middle, PostgreSQL as the durable source of truth, and focused SQL builders for performance-sensitive database access.

The service leans on bulk writes, keyset pagination, minute rollups, bounded retention, and a limited index set to satisfy the required contract under constrained CPU and memory. Comments throughout the workspace explain these choices close to the code so reviewers can connect the rationale to the implementation.
