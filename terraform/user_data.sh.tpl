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
DATABASE_USERNAME=${db_username}
DATABASE_PASSWORD='${db_password}'

# Redis
REDIS_HOST=${redis_host}

# S3
FILES_BUCKET_NAME=${s3_bucket_name}
FILE_NAME_ENCRYPTION_KEY=$FILE_NAME_ENCRYPTION_KEY
AWS_SQS_UPLOAD_QUEUE_URL=${sqs_queue_url}

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
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_repo_url}

# Run Docker Compose
docker compose -f docker-compose.yaml up -d