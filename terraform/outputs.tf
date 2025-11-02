output "application_url" {
  description = "The URL of the deployed web application."
  value       = "http://${module.alb.alb_dns_name}"
}

output "ecr_repository_url" {
  description = "The URL of the ECR repository to push images to."
  value       = module.ecr.repository_url
}

output "rds_db_address" {
  description = "The address of the RDS instance."
  value       = module.rds.db_instance_address
}

output "elasticache_primary_endpoint" {
  description = "The primary endpoint of the ElastiCache Redis replication group."
  value       = module.elasticache.redis_primary_endpoint
}

output "aws_region" {
  description = "The AWS region where resources are deployed."
  value       = var.aws_region
}