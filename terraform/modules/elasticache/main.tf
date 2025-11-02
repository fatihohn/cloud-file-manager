resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.private_subnets

  tags = {
    Project     = "cloud-file-manager"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = "${var.name}-replication-group"
  description                   = "${var.name} Redis replication group"
  node_type                     = var.node_type
  num_cache_clusters            = var.num_cache_clusters
  port                          = 6379
  parameter_group_name          = "default.redis${var.redis_version}"
  engine_version                = var.redis_version
  subnet_group_name             = aws_elasticache_subnet_group.main.name
  security_group_ids            = [aws_security_group.elasticache_sg.id]
  automatic_failover_enabled    = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true

  tags = {
    Project     = "cloud-file-manager"
    Environment = var.environment
  }
}

resource "aws_security_group" "elasticache_sg" {
  name        = "${var.name}-elasticache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    security_groups = [var.app_security_group_id] # 애플리케이션 SG로부터의 접근 허용
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project     = "cloud-file-manager"
    Environment = var.environment
  }
}
