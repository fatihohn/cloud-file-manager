output "redis_primary_endpoint" {
  description = "The primary endpoint of the ElastiCache Redis replication group."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "elasticache_security_group_id" {
  description = "The ID of the security group created for ElastiCache."
  value       = aws_security_group.elasticache_sg.id
}
