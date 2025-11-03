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

## AWS Deployment

This application can also be deployed to AWS using Terraform. The AWS deployment leverages services like VPC, EC2, RDS, ElastiCache, S3, SQS, and **API Gateway for secure access with API Keys**.

For detailed deployment instructions and how to manage the AWS infrastructure, please refer to the dedicated [Terraform README](./terraform/README.md).

### Accessing the Deployed API

The application is deployed to AWS and is accessible via an Application Load Balancer (ALB).

To access the deployed API and Swagger documentation:

1.  **Obtain the Application Load Balancer (ALB) URL:**

    Run the following command from the `terraform` directory to get the base URL:

    ```bash

    terraform output -raw application_url

    ```

    This will output a URL like `http://cloud-file-manager-dev-alb-xxxxxxxxxx.ap-northeast-2.elb.amazonaws.com`.

2.  **Access the API:**

    You can make API calls directly to the ALB URL.

    **Example using `curl`:**

    Replace `<YOUR_ALB_URL>` with the URL obtained from `terraform output`.

    ```bash

    curl -v -X GET \

      "<YOUR_ALB_URL>/users"

    ```

3.  **Access Swagger Documentation:**

    The interactive API documentation (Swagger UI) is available at the `/docs` path relative to the ALB URL.

    **Example:**

    If your ALB URL is `http://<ALB_DNS_NAME>`, then Swagger UI is at `http://<ALB_DNS_NAME>/docs`.

    You can access this directly in your web browser.
