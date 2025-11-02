# Cloud File Manager - Terraform Infrastructure

This Terraform configuration is designed to deploy and manage the `cloud-file-manager` application on AWS.

## 1. Architecture Overview

This infrastructure is modularly designed for scalability, security, and maintainability, utilizing the following AWS services:

- **Amazon VPC**: An isolated virtual network environment for the application, configured with public and private subnets. Includes a **NAT Gateway** for outbound internet access from private subnets and **VPC Endpoints (for SSM, S3)** for secure, private access to AWS services.
- **Amazon ECR**: A private container registry to store the Docker images for the application (API, workers).
- **Amazon S3**: An object storage service for persistent storage of user-uploaded files.
- **Amazon RDS (PostgreSQL)**: A managed database service for the application's primary data storage, configured for private access.
- **Amazon ElastiCache (Redis)**: A high-performance in-memory cache service for session management and caching.
- **AWS SQS**: A message queuing service used for inter-service communication (e.g., file processing).
- **AWS IAM**: Provides IAM Roles to grant the EC2 instances secure permissions to access other AWS services like ECR, S3, SQS, and Secrets Manager. Also enables **SSM Session Manager** for secure instance access.
- **Amazon EC2**: Virtual servers located in private subnets that run the application in Docker containers.
- **Application Load Balancer (ALB)**: Located in public subnets, it receives HTTP traffic and securely distributes it to the EC2 instances. Its security group is configured to only accept traffic from **AWS API Gateway**.
- **AWS API Gateway**: Sits in front of the ALB, providing a single entry point for the API. It handles **API Key authentication** and can enforce usage plans.
- **Amazon CloudWatch Logs**: Centralizes and manages logs from the application running on the EC2 instances.

## 2. File Structure

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

## 3. Deployment Procedure

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

The application's Docker image must be built for the `amd64` architecture and pushed to ECR before it can be run by the EC2 instances. This step should be performed manually before `terraform apply`.

```bash
# 1. Get the ECR repository information (after ECR is created by terraform apply)
#    Run 'terraform output -raw ecr_repository_url' from the terraform directory.
export REPO_URL="<YOUR_ECR_REPOSITORY_URL>"
#    Run 'terraform output -raw aws_region' from the terraform directory.
export AWS_REGION="<YOUR_AWS_REGION>"

# 2. Log in to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPO_URL

# 3. Build the image for amd64 architecture and push to ECR (run from the project's root directory)
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

## 4. Accessing the API (via API Gateway with API Key)

After `terraform apply` completes successfully, the API will be accessible via the API Gateway Invoke URL. You will need to include an `x-api-key` header with your requests.

### Get API Gateway URL and API Key

Run the following commands from the `terraform` directory:

```bash
# Get the API Gateway Invoke URL
terraform output -raw api_gateway_invoke_url

# Get the generated API Key
terraform output -raw api_key_value
```

### Example API Call

Use `curl` (or Postman/Insomnia) to test your API. Replace `<YOUR_API_GATEWAY_INVOKE_URL>` and `<YOUR_API_KEY_VALUE>` with the actual values obtained from the `terraform output` commands.

```bash
curl -v -X GET \
  "<YOUR_API_GATEWAY_INVOKE_URL>/users" \
  -H "x-api-key: <YOUR_API_KEY_VALUE>"
```

## 5. Cleanup

To destroy all deployed AWS resources and avoid further charges, run the following command. (Warning: This will permanently delete your data.)

```bash
terraform destroy
```
