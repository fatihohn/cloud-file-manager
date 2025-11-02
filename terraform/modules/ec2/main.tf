resource "aws_instance" "app_instance" {
  count         = var.instance_count
  ami           = var.ami_id
  instance_type = var.instance_type

  subnet_id = var.private_subnets[count.index % length(var.private_subnets)]

  vpc_security_group_ids = [var.app_security_group_id]
  iam_instance_profile   = var.iam_instance_profile_name

  user_data = var.user_data

  tags = {
    Name        = "${var.project_name}-${var.environment}-app-instance-${count.index}"
    Project     = var.project_name
    Environment = var.environment
  }
}
