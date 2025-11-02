#!/bin/bash
# Install Docker, Docker Compose, Git, JQ
yum update -y
yum install -y docker git jq
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Create a working directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Fetch secrets from Secrets Manager
JWT_ACCESS_SECRET=$(aws secretsmanager get-secret-value --secret-id ${jwt_access_secret_arn} --region ${aws_region} | jq -r .SecretString)
JWT_REFRESH_SECRET=$(aws secretsmanager get-secret-value --secret-id ${jwt_refresh_secret_arn} --region ${aws_region} | jq -r .SecretString)
FILE_NAME_ENCRYPTION_KEY=$(aws secretsmanager get-secret-value --secret-id ${file_encryption_key_arn} --region ${aws_region} | jq -r .SecretString)

# Create .env file from Terraform variables
cat <<EOF > .env
# Database
DATABASE_HOST=${db_host}
DATABASE_PORT=5432
POSTGRES_USER=${db_username}
POSTGRES_PASSWORD='${db_password}'
POSTGRES_DATABASE=${db_name}
DATABASE_SSL=true

# Redis
REDIS_HOST=${redis_host}
REDIS_PORT=${redis_port}

# S3
FILES_BUCKET_NAME=${s3_bucket_name}
FILE_NAME_ENCRYPTION_KEY=$FILE_NAME_ENCRYPTION_KEY
AWS_SQS_UPLOAD_QUEUE_URL=${sqs_queue_url}

# BullMQ
BULLMQ_ATTEMPTS=${bullmq_attempts}
BULLMQ_BACKOFF_DELAY=${bullmq_backoff_delay}
BULLMQ_REMOVE_ON_COMPLETE=${bullmq_remove_on_complete}
BULLMQ_REMOVE_ON_FAIL=${bullmq_remove_on_fail}

# File Uploads
MAX_UPLOAD_BYTES=${max_upload_bytes}
FILES_DOWNLOAD_URL_TTL_SECONDS=${files_download_url_ttl_seconds}


# JWT
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRATION=${jwt_access_expiration}
JWT_REFRESH_EXPIRATION=${jwt_refresh_expiration}

# AWS
AWS_REGION=${aws_region}
EOF

# Create docker-compose.yaml from template variable
cat <<EOF > docker-compose.yaml
${docker_compose_content}
EOF

# Login to ECR
sudo aws ecr get-login-password --region ${aws_region} | sudo docker login --username AWS --password-stdin ${ecr_repo_url}

# Run Docker Compose
sudo /usr/local/bin/docker-compose -f docker-compose.yaml up -d
