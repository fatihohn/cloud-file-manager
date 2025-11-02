# Cloud File Manager

This project is a complete system for a cloud file management application, including a REST API, background workers, and other services, all containerized for easy deployment and development.

For detailed information on the backend API, see the [backend README](./cloud-file-manager-backend/README.md).

## Architecture Overview

The system runs as a collection of services orchestrated by Docker Compose:

- **Nginx:** A reverse proxy that routes incoming traffic on port `80` to the backend API.
- **Backend API (`cloud-file-manager-backend-api`):** The core NestJS application that handles user authentication, file metadata, and generating presigned URLs.
- **Users Worker (`cloud-file-manager-backend-users-worker`):** A separate NestJS application instance that processes asynchronous background jobs related to users from a Redis-backed queue (e.g., user-related tasks).
- **Files Worker (`cloud-file-manager-backend-files-worker`):** A separate NestJS application instance that processes asynchronous background jobs related to files from a Redis-backed queue (e.g., file processing, cascading soft-deletes).
- **PostgreSQL:** The primary database for storing user and file metadata.
- **Redis:** Used as a message broker for the BullMQ job queue.

## Getting Started

This project is designed to be run with Docker. Ensure you have Docker and Docker Compose installed.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/fatihohn/cloud-file-manager.git
    cd cloud-file-manager
    ```

2.  **Create Environment File:**
    An `.env` file is required to store secrets and configuration. Copy the example file:

    ```bash
    cp .env.example .env
    ```

3.  **Configure Environment Variables:**
    Open the newly created `.env` file and fill in the **Required** values. See the [backend README](./cloud-file-manager-backend/README.md) for a detailed description of all variables.

4.  **Build and Run Containers:**
    ```bash
    docker compose up -d --build
    ```

## Usage

- **API Server:** The API is accessible via the Nginx proxy at `http://localhost`.
- **API Documentation:** Interactive API (Swagger) documentation is available at `http://localhost/docs`.
