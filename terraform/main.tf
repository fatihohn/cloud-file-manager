data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_cloudwatch_log_group" "app_log_group" {
  name              = "/aws/ec2/${var.project_name}-${var.environment}"
  retention_in_days = 7
}

resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name = "${var.environment}/jwt/accessSecret"
}

resource "aws_secretsmanager_secret_version" "jwt_access_secret_version" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = var.jwt_access_secret
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name = "${var.environment}/jwt/refreshSecret"
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret_version" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = var.jwt_refresh_secret
}

resource "aws_secretsmanager_secret" "file_encryption_key" {
  name = "${var.environment}/file/encryptionKey"
}

resource "aws_secretsmanager_secret_version" "file_encryption_key_version" {
  secret_id     = aws_secretsmanager_secret.file_encryption_key.id
  secret_string = var.file_name_encryption_key
}

module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
  environment  = var.environment
}

module "s3" {
  source       = "./modules/s3"
  bucket_name  = "${var.project_name}-${var.environment}-uploads-bucket"
  project_name = var.project_name
  environment  = var.environment
}

module "iam" {
  source               = "./modules/iam"
  project_name         = var.project_name
  environment          = var.environment
  s3_bucket_arn        = module.s3.bucket_arn
  secrets_manager_arns = [
    aws_secretsmanager_secret.jwt_access_secret.arn,
    aws_secretsmanager_secret.jwt_refresh_secret.arn,
    aws_secretsmanager_secret.file_encryption_key.arn
  ]
}

module "alb" {
  source            = "./modules/alb"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnets    = module.vpc.public_subnet_ids
  instance_ids      = module.ec2_api.instance_ids
  health_check_path = "/health"
}

resource "aws_security_group" "app_sg" {
  name        = "${var.environment}-app-sg"
  description = "Security group for application instances"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [module.alb.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

module "ec2_api" {
  source                    = "./modules/ec2"
  project_name              = var.project_name
  environment               = var.environment
  instance_count            = 1
  ami_id                    = data.aws_ami.amazon_linux_2.id
  instance_type             = "t3.micro"
  private_subnets           = module.vpc.private_subnet_ids
  app_security_group_id     = aws_security_group.app_sg.id
  iam_instance_profile_name = module.iam.iam_instance_profile_name
  user_data                 = templatefile("${path.module}/user_data.sh.tpl", {
    aws_region             = var.aws_region,
    ecr_repo_url           = module.ecr.repository_url,
    db_host                = module.rds.db_instance_address,
    db_username            = var.db_username,
    db_password            = var.db_password,
    redis_host             = module.elasticache.redis_primary_endpoint,
    s3_bucket_name         = module.s3.bucket_id,
    log_group_name         = aws_cloudwatch_log_group.app_log_group.name,
    jwt_access_secret_arn  = aws_secretsmanager_secret.jwt_access_secret.arn,
    jwt_refresh_secret_arn = aws_secretsmanager_secret.jwt_refresh_secret.arn,
    jwt_access_expiration  = var.jwt_access_expiration,
    jwt_refresh_expiration = var.jwt_refresh_expiration,
    file_encryption_key_arn = aws_secretsmanager_secret.file_encryption_key.arn,
    sqs_queue_url           = module.sqs.queue_url,
    docker_compose_content = templatefile("../cloud-file-manager-backend/docker-compose.api.yaml", {
      ECR_REPO_URL   = module.ecr.repository_url,
      AWS_REGION     = var.aws_region,
      LOG_GROUP_NAME = aws_cloudwatch_log_group.app_log_group.name
    })
  })
}

module "ec2_workers" {
  source                    = "./modules/ec2"
  project_name              = "${var.project_name}-workers"
  environment               = var.environment
  instance_count            = 1
  ami_id                    = data.aws_ami.amazon_linux_2.id
  instance_type             = "t3.micro"
  private_subnets           = module.vpc.private_subnet_ids
  app_security_group_id     = aws_security_group.app_sg.id
  iam_instance_profile_name = module.iam.iam_instance_profile_name
  user_data                 = templatefile("${path.module}/user_data.sh.tpl", {
    aws_region             = var.aws_region,
    ecr_repo_url           = module.ecr.repository_url,
    db_host                = module.rds.db_instance_address,
    db_username            = var.db_username,
    db_password            = var.db_password,
    redis_host             = module.elasticache.redis_primary_endpoint,
    s3_bucket_name         = module.s3.bucket_id,
    log_group_name         = aws_cloudwatch_log_group.app_log_group.name,
    jwt_access_secret_arn  = aws_secretsmanager_secret.jwt_access_secret.arn,
    jwt_refresh_secret_arn = aws_secretsmanager_secret.jwt_refresh_secret.arn,
    jwt_access_expiration  = var.jwt_access_expiration,
    jwt_refresh_expiration = var.jwt_refresh_expiration,
    file_encryption_key_arn  = aws_secretsmanager_secret.file_encryption_key.arn,
    sqs_queue_url            = module.sqs.queue_url,
    docker_compose_content = templatefile("../cloud-file-manager-backend/docker-compose.workers.yaml", {
      ECR_REPO_URL   = module.ecr.repository_url,
      AWS_REGION     = var.aws_region,
      LOG_GROUP_NAME = aws_cloudwatch_log_group.app_log_group.name
    })
  })
}

module "elasticache" {
  source                  = "./modules/elasticache"
  name                    = var.project_name
  vpc_id                  = module.vpc.vpc_id
  private_subnets         = module.vpc.private_subnet_ids
  environment             = var.environment
  app_security_group_id   = aws_security_group.app_sg.id
}

module "rds" {
  source                  = "./modules/rds"
  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnets         = module.vpc.private_subnet_ids
  app_security_group_id   = aws_security_group.app_sg.id
  db_name                 = var.db_name
  db_username             = var.db_username
  db_password             = var.db_password
}

module "ecr" {
  source          = "./modules/ecr"
  repository_name = "${var.project_name}-backend"
  environment     = var.environment
}

module "sqs" {
  source       = "./modules/sqs"
  queue_name   = "${var.project_name}-${var.environment}-upload-queue"
  project_name = var.project_name
  environment  = var.environment
}