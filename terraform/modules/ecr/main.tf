resource "aws_ecr_repository" "app_repository" {
  name                 = var.repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = {
    Project     = "cloud-file-manager"
    Environment = var.environment
  }
}
