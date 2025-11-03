# Cloud File Manager - Terraform Infrastructure

This Terraform configuration is designed to deploy and manage the `cloud-file-manager` application on AWS.

## 1. Infrastructure Architecture

This architecture is designed to deploy a scalable and reliable web application on AWS. The main components are:

1.  **Network (VPC)**: All resources are deployed within an isolated Virtual Private Cloud (VPC). It consists of a **Public Subnet** for external communication and a **Private Subnet** to protect internal resources.

2.  **Application (EC2 & Docker)**:

    - The application is containerized using Docker and stored in **ECR (Elastic Container Registry)**.
    - An **API Server** for handling user requests and a **Worker Server** for background tasks are deployed in separate **EC2 Instance** groups within the Private Subnet. This separation of roles enhances stability and scalability.
    - When EC2 instances launch, a `user_data` script automatically runs Docker Compose to start the application.

3.  **Traffic Management (API Gateway & ALB)**:

    - All user requests enter through an **API Gateway**, a managed service that handles request routing, authentication, rate limiting, etc.
    - The API Gateway forwards requests to an **ALB (Application Load Balancer)**.
    - The ALB, located in the Public Subnet, distributes traffic across multiple EC2 API servers in the Private Subnet, ensuring load balancing and high availability.

4.  **Data Storage**:

    - **RDS (Relational Database Service)**: A PostgreSQL database is deployed in the Private Subnet to securely store structured data like user information and file metadata.
    - **S3 (Simple Storage Service)**: User-uploaded files are stored in an S3 bucket.
    - **ElastiCache (Redis)**: Used for caching and as a message broker for BullMQ to improve application performance.

5.  **Asynchronous Processing (SQS)**:

    - **SQS (Simple Queue Service)** is used to handle time-consuming tasks like file uploads asynchronously.
    - The API server enqueues jobs to SQS, and the Worker server dequeues and processes them. This shortens the API server's response time.

6.  **Security & Management**:
    - **IAM (Identity and Access Management)**: Minimal privilege IAM roles are assigned to AWS resources (e.g., EC2) to securely access other resources (e.g., S3, SQS).
    - **Secrets Manager**: Sensitive information like database passwords and JWT secrets are securely stored in Secrets Manager and dynamically retrieved at runtime.
    - **CloudWatch Logs**: All logs from the EC2 instances are centralized and managed in CloudWatch.

## 2. Infrastructure Diagram (Text)

```
+----------------------------------------------------------------------------------------------------------+
|                                                AWS Cloud                                                 |
|                                                                                                          |
|    +----------------+      +--------------------+      +-----------------+      +----------------------+ |
|    |      ECR       |      |         S3         |      | Secrets Manager |      |   CloudWatch Logs    | |
|    +----------------+      +--------------------+      +-----------------+      +----------------------+ |
|            ^                       ^                         ^                          ^                |
|            | (pull image)          | (r/w files)             | (read secrets)           | (send logs)    |
|  +---------+-----------------------+-------------------------+--------------------------+------------+   |
|  |                                          VPC                                                      |   |
|  | +----------------------------------+      +-----------------------------------------------------+ |   |
|  | |         Public Subnet            |      |                    Private Subnet                   | |   |
|  | |                                  |      |                                                     | |   |
|  | |  +---------------------------+   |      |   +-------------------------------------------+     | |   |
|  | |  |      Application Load     |   |      |   |            EC2 Auto Scaling Group         |     | |   |
|  | |  |        Balancer (ALB)     |----------->  |               (API & Workers)             |     | |   |
|  | |  +---------------------------+   |      |   +-------------------------------------------+     | |   |
|  | |                                  |      |                        |                            | |   |
|  | +----------------------------------+      |                        |                            | |   |
|  |                                           |   +--------------------+--------------------+       | |   |
|  |                                           |   |                    |                    |       | |   |
|  |                                           |   v                    v                    v       | |   |
|  |                                           | +------+         +-------------+         +----+     | |   |
|  |                                           | | RDS  |         | ElastiCache |         | SQS|     | |   |
|  |                                           | +------+         |   (Redis)   |         +----+     | |   |
|  |                                           |                  +-------------+                    | |   |
|  |                                           |                                                     | |   |
|  |                                           +-----------------------------------------------------+ |   |
|  +---------------------------------------------------------------------------------------------------+   |
|                                                                                                          |
+----------------------------------------------------------------------------------------------------------+
      ^
      |
+-----+------------------+
|   API Gateway          |
+------------------------+
      ^
      |
+-----+------+
|   User     |
+------------+
```

**Flow Summary:**

1.  **User Request**: `User` -> `API Gateway`
2.  **Traffic Distribution**: `API Gateway` -> `ALB` -> `EC2 (API)`
3.  **Application Logic**: The `EC2 (API)` instance communicates with `RDS` and `ElastiCache`, and sends messages to `SQS` if needed.
4.  **Asynchronous Task**: The `EC2 (Workers)` instance fetches messages from `SQS` and performs tasks like processing files in `S3`.
5.  **Container Images**: EC2 instances pull Docker images from `ECR` to run the application.
6.  **Security Credentials**: EC2 instances retrieve sensitive data from `Secrets Manager`.

## 3. File Structure

The Terraform code is organized into modules to promote reusability and maintainability.

- `main.tf`, `variables.tf`, `outputs.tf`: The root module files, responsible for orchestrating all other infrastructure modules.
- `versions.tf`: Defines the required versions for Terraform and its providers.
- `user_data.sh.tpl`: A shell script template used for initializing the EC2 instances, installing Docker, and configuring the application.
- `modules/`: Contains reusable modules for each major AWS component.
  - `vpc/`: Network infrastructure
  - `ecr/`: ECR repository
  - `s3/`: S3 bucket
  - `rds/`: RDS database
  - `elasticache/`: ElastiCache for Redis
  - `iam/`: IAM roles and policies
  - `ec2/`: EC2 instances
  - `alb/`: Application Load Balancer
  - `sqs/`: SQS queue
  - `api_gateway/`: API Gateway for API Key management

## 4. Deployment Procedure

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) CLI (ARM64 version for Apple Silicon Macs recommended)
- [AWS CLI](https://aws.amazon.com/cli/) (Configured with credentials via `aws configure`)
- [Docker](https://www.docker.com/products/docker-desktop/) (with `buildx` enabled for multi-architecture builds)

### Step 1: Configure Variables

Create a `terraform.tfvars` file in the root directory (`terraform/`) to provide values for sensitive variables and override defaults. This file is ignored by Git via `.gitignore`.

**`terraform.tfvars.example`**

```hcl
db_password = "YOUR_SUPER_SECRET_PASSWORD"
# Other variables you might want to override:
# db_name = "cloudfilemanager"
# db_username = "cloudfilemanager"
# jwt_access_expiration = "1h"
# jwt_refresh_expiration = "7d"
# bullmq_attempts = 3
# bullmq_backoff_delay = 1000
# bullmq_remove_on_complete = 50
# bullmq_remove_on_fail = 100
# redis_port = 6379
# max_upload_bytes = 1073741824
# files_download_url_ttl_seconds = 300
```

### Step 2: Build and Push Docker Image (First time or on app update)

The application\'s Docker image must be built for the `amd64` architecture and pushed to ECR before it can be run by the EC2 instances. This step should be performed manually before `terraform apply`.

```bash
# 1. Get the ECR repository information (after ECR is created by terraform apply)
#    Run 'terraform output -raw ecr_repository_url' from the terraform directory.
export REPO_URL="<YOUR_ECR_REPOSITORY_URL>"
#    Run 'terraform output -raw aws_region' from the terraform directory.
export AWS_REGION="<YOUR_AWS_REGION>"

# 2. Log in to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPO_URL

# 3. Build the image for amd64 architecture and push to ECR (run from the project\'s root directory)
#    Ensure you are in the project root: /path/to/cloud-file-manager
docker buildx build --platform linux/amd64 -t $REPO_URL:latest -f cloud-file-manager-backend/Dockerfile . --push
```

> **Note**: If the ECR repository does not exist yet, you must first run `terraform apply` to create it, then run the commands above.

### Step 3: Deploy Terraform Infrastructure

```bash
# Navigate to the Terraform directory
cd /path/to/cloud-file-manager/terraform

# 1. Initialize Terraform (downloads providers and modules)
terraform init

# 2. Review the execution plan
terraform plan

# 3. Deploy the infrastructure
terraform apply
```

## 5. Accessing the Deployed API

> **Note on API Gateway and `/docs` access:** While the infrastructure is set up to restrict API access via API Keys through API Gateway, the `application_url` is currently left open (not protected by API Gateway) to allow access to the `/docs` endpoint. This is a temporary measure to address access issues with the Swagger UI.

The application is deployed to AWS and is accessible via an Application Load Balancer (ALB).

To access the deployed API and Swagger documentation:

1.  **Obtain the Application Load Balancer (ALB) URL:**
    Run the following command from this `terraform` directory to get the base URL:

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

## 6. Cleanup

To destroy all deployed AWS resources and avoid further charges, run the following command. (Warning: This will permanently delete your data.)

```bash
terraform destroy
```
