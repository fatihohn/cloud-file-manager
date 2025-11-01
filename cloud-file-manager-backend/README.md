# Cloud File Manager Backend API

This document provides detailed information about the NestJS backend API for the Cloud File Manager project.

## Features

- **Authentication:** Secure user authentication using JWT (Access & Refresh Tokens).
- **User Management:** User registration, profile management, and soft-delete functionality.
- **File Management:**
  - Scalable file uploads directly to AWS S3 using presigned POST URLs.
  - File size and MIME type validation.
  - Secure file downloads using presigned GET URLs.
  - File metadata management.
  - Soft-delete for files.
- **Role-Based Access Control (RBAC):**
  - `Admin` role can view all user and file data.
  - `Member` role can only access their own data.
- **Background Processing:** Asynchronous job processing using BullMQ and Redis for tasks like cascading deletes.

## Tech Stack

- **Backend:** NestJS, TypeScript
- **Database:** PostgreSQL, TypeORM
- **Caching/Queues:** Redis, BullMQ
- **Cloud Storage:** AWS S3
- **Testing:** Jest, Supertest

---

## Environment Variables

Configure the following environment variables in your root `.env` file (next to `docker-compose.yaml`).

| Variable | Description |
| :--- | :--- |
| `NODE_ENV` | Application environment (`development` or `production`). |
| `PORT` | The port the backend API will listen on. Default: `3000`. |
| `JWT_ACCESS_SECRET` | Secret key for signing JWT access tokens. |
| `JWT_REFRESH_SECRET`| Secret key for signing JWT refresh tokens. |
| `JWT_ACCESS_EXPIRATION` | Expiration time for access tokens (e.g., `30m`). |
| `JWT_REFRESH_EXPIRATION`| Expiration time for refresh tokens (e.g., `1h`). |
| `FILES_BUCKET_NAME` | **Required.** Your AWS S3 bucket name for file uploads. |
| `FILE_NAME_ENCRYPTION_KEY` | **Required.** A base64-encoded 32-byte key for encrypting filenames. |
| `MAX_UPLOAD_BYTES` | Maximum file upload size in bytes. Default: `52428800` (50 MB). |
| `FILES_DOWNLOAD_URL_TTL_SECONDS` | Expiration time for presigned download URLs in seconds. Default: `300`. |
| `MULTER_TMP_DIR` | Temporary directory for Multer (if direct uploads were enabled). Default: `/tmp/cfm-upload`. |
| `DATABASE_HOST` | Database host. Default: `postgres`. |
| `DATABASE_PORT` | Database port. Default: `5432`. |
| `POSTGRES_USER` | **Required.** Your PostgreSQL username. |
| `POSTGRES_PASSWORD` | **Required.** Your PostgreSQL password. |
| `POSTGRES_DATABASE` | **Required.** Your PostgreSQL database name. |
| `AWS_REGION` | **Required.** The AWS region for your S3 bucket and SQS queue. |
| `AWS_ACCESS_KEY_ID` | **Required.** Your AWS access key ID. |
| `AWS_SECRET_ACCESS_KEY` | **Required.** Your AWS secret access key. |
| `AWS_SQS_UPLOAD_QUEUE_URL` | **Required.** The full URL of the SQS queue that receives S3 upload notifications. |
| `REDIS_HOST` | Redis host. Default: `redis`. |
| `REDIS_PORT` | Redis port. Default: `6379`. |
| `REDIS_USERNAME` | Optional Redis username. |
| `REDIS_PASSWORD` | Optional Redis password. |
| `REDIS_TLS` | Set to `true` if connecting to a TLS-enabled Redis (e.g., ElastiCache). |
| `BULLMQ_ATTEMPTS` | Default retry count per job. Default: `3`. |
| `BULLMQ_BACKOFF_DELAY` | Exponential backoff delay in milliseconds. Default: `1000`. |
| `BULLMQ_REMOVE_ON_COMPLETE` | Job retention limit for completed jobs. Default: `50`. |
| `BULLMQ_REMOVE_ON_FAIL` | Job retention limit for failed jobs. Default: `100`. |

---

## Running Locally (without Docker Compose)

These instructions are for running the backend API or worker service directly on your machine, outside of Docker Compose.

### Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 15+
- Redis 7+ (or AWS ElastiCache compatible endpoint)

### PostgreSQL UUID setup

User IDs use UUID primary keys. Make sure your database enables the extension once:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Installation

```bash
cd cloud-file-manager-backend
npm install
```

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

---

## API Documentation

Interactive API (Swagger) documentation is available when the API server is running at `http://localhost/docs`.

---

## Running Tests

A pre-commit hook is configured to run tests automatically before each commit. To run the tests manually:

```bash
docker compose up -d
docker exec cloud-file-manager-backend-api sh -c "cd /app && npm run test:e2e"
```

---

## Error Handling

The API returns structured error responses to help frontend developers handle failures gracefully.

### General Error Structure

```json
{
  "code": "ERROR_CODE",
  "message": "A human-readable error message."
}
```

### Validation Errors

For input validation failures (e.g., invalid email format, weak password), the API returns a `400 Bad Request` with the following structure:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "errors": [
    {
      "field": "password",
      "reason": "IS_LENGTH",
      "message": "Password must be at least 12 characters long"
    },
    {
      "field": "password",
      "reason": "MATCHES",
      "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    }
  ]
}
```

### Common API Error Codes

| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `EMAIL_IN_USE` | 409 Conflict | The provided email is already registered. |
| `USER_NOT_FOUND` | 404 Not Found | The specified user does not exist. |
| `INVALID_CREDENTIALS` | 401 Unauthorized | The email or password provided during sign-in is incorrect. |
| `FILE_NOT_FOUND` | 404 Not Found | The requested file does not exist or you do not have permission to access it. |
| `UPLOAD_TOO_LARGE` | 413 Payload Too Large | The file size exceeds the configured `MAX_UPLOAD_BYTES` limit. |
| `UNSUPPORTED_FILE_TYPE`| 400 Bad Request | The file's MIME type is not supported (only `text/csv` and `application/vnd.ms-excel` is allowed). |
