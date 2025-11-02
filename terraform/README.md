# Cloud File Manager - Terraform Infrastructure

This Terraform configuration is designed to deploy and manage the `cloud-file-manager` application on AWS.

## 1. Architecture Overview

This infrastructure is modularly designed for scalability, security, and maintainability, utilizing the following AWS services:

- **Amazon VPC**: An isolated virtual network environment for the application, configured with public and private subnets to control access.
- **Amazon ECR**: A private container registry to store the Docker images for the application (API, workers).
- **Amazon S3**: An object storage service for persistent storage of user-uploaded files.
- **Amazon RDS (PostgreSQL)**: A managed database service for the application's primary data storage.
- **Amazon ElastiCache (Redis)**: A high-performance in-memory cache service for session management and caching.
- **AWS IAM**: Provides IAM Roles to grant the EC2 instances secure permissions to access other AWS services like ECR and S3.
- **Amazon EC2**: Virtual servers located in private subnets that run the application in Docker containers.
- **Application Load Balancer (ALB)**: Located in public subnets, it receives incoming HTTP traffic and securely distributes it to the EC2 instances.
- **Amazon CloudWatch Logs**: Centralizes and manages logs from the application running on the EC2 instances.

## 2. File Structure

The Terraform code is organized into modules to promote reusability and maintainability.

- `main.tf`, `variables.tf`, `outputs.tf`: The root module files, responsible for orchestrating all other infrastructure modules.
- `versions.tf`: Defines the required versions for Terraform and its providers.
- `user_data.sh.tpl`: A shell script template used for initializing the EC2 instances.
- `modules/`: Contains reusable modules for each major AWS component.
  - `vpc/`: Network infrastructure
  - `ecr/`: ECR repository
  - `s3/`: S3 bucket
  - `rds/`: RDS database
  - `elasticache/`: ElastiCache for Redis
  - `iam/`: IAM roles and policies
  - `ec2/`: EC2 instances
  - `alb/`: Application Load Balancer

## 3. Deployment Procedure

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) CLI (ARM64 version for Apple Silicon Macs)
- [AWS CLI](https://aws.amazon.com/cli/) (Configured with credentials via `aws configure`)
- [Docker](https://www.docker.com/products/docker-desktop/)

### Step 1: Configure Variables

Create a `terraform.tfvars` file in the root directory (`terraform/`) to provide values for sensitive variables. This file is ignored by Git via `.gitignore`.

**`terraform.tfvars.example`**

```hcl
db_password = "YOUR_SUPER_SECRET_PASSWORD"
# Other variables like db_name, db_username can also be overridden here if needed.
```

### Step 2: Build and Push Docker Image (First time or on app update)

The application's Docker image must be pushed to ECR before it can be run by the EC2 instances. This step should be performed manually before `terraform apply`.

```bash
# 1. Get the ECR repository information (after ECR is created by terraform apply)
export REPO_URL=$(terraform output -raw ecr_repository_url)
export AWS_REGION=$(terraform output -raw aws_region) # Example

# 2. Log in to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPO_URL

# 3. Build the image (run from the project's root directory)
docker build -t $REPO_URL:latest -f cloud-file-manager-backend/Dockerfile .

# 4. Push the image
docker push $REPO_URL:latest
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

After the `apply` command completes successfully, the `application_url` will be displayed in the outputs. You can use this URL to access the deployed service.

## 4. Cleanup

To destroy all deployed AWS resources and avoid further charges, run the following command. (Warning: This will permanently delete your data.)

```bash
terraform destroy
```
