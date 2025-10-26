# Cloud File Manager Backend

NestJS + TypeORM service that exposes the Cloud File Manager API and pushes asynchronous work to BullMQ workers. The API container serves HTTP traffic, while a separate worker container handles Redis-backed queues.

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 15+
- Redis 7+ (or AWS ElastiCache compatible endpoint)

### PostgreSQL UUID setup

User IDs use UUID primary keys. Make sure your database enables the extension once:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Installation

```bash
npm install
```

## Running locally

### API service

```bash
# development
npm run start:api

# watch mode
npm run start:dev

# production build
npm run build
npm run start:prod
```

### Worker service

```bash
# development
npm run start:worker

# watch mode
npm run start:worker:dev

# production runtime
npm run build
npm run start:worker:prod
```

The worker bootstraps the same Nest container without an HTTP server and only registers queue processors (see `WorkerAppModule`).

## Docker Compose (local)

`docker-compose.yaml` now defines two runtime containers:

- `api`: API server running `npm run start:dev`
- `worker`: BullMQ worker running `npm run start:worker:dev`

Both containers share the project volume, Redis, and PostgreSQL. Logs are written to `./logs/cloud-file-manager-backend` so you can tail both services independently.

## Environment variables

Update `.env` (or `.env.example`) with the following queue-focused settings in addition to the existing database/JWT values:

- `REDIS_HOST`, `REDIS_PORT` – Redis/ElastiCache endpoint
- `REDIS_USERNAME`, `REDIS_PASSWORD` – optional auth values
- `REDIS_TLS` – set to `true` when connecting to TLS-enabled ElastiCache
- `BULLMQ_ATTEMPTS` – default retry count per job (default `3`)
- `BULLMQ_BACKOFF_DELAY` – exponential backoff delay in ms (default `1000`)
- `BULLMQ_REMOVE_ON_COMPLETE`, `BULLMQ_REMOVE_ON_FAIL` – job retention limits

See `docs/aws-queue-refactor-plan.md` for the full migration rationale.

> **docker-compose tip**  
> The root-level `.env` file (next to `docker-compose.yaml`) is the one injected into both the API and worker containers. If you keep another `.env` inside `cloud-file-manager-backend/`, remember that Compose will not read it. This is especially important for settings such as `MAX_UPLOAD_BYTES`; update the root `.env` when you need to raise or lower the upload ceiling so that Multer and the API container pick up the intended limit.

## AWS deployment notes

- Build a single Docker image (`docker build .`) and run it with different commands per task definition:
  - API task: `node dist/main.js`
  - Worker task: `node dist/main.worker.js`
- Provide Redis/ElastiCache credentials through SSM or Secrets Manager; the worker and API read the same `REDIS_*` vars.
- Configure CloudWatch log groups independently for API and worker to simplify troubleshooting.

## Scripts

- `npm run lint` – ESLint plus auto-fixes
- `npm run test` / `npm run test:e2e` – unit and e2e suites
- `npm run build` – compiles both API (`main.ts`) and worker (`main.worker.ts`) entrypoints
