variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
}

variable "vpc_id" {
  description = "The ID of the VPC where the ALB will be placed."
  type        = string
}

variable "public_subnets" {
  description = "A list of public subnet IDs for the ALB."
  type        = list(string)
}

variable "instance_ids" {
  description = "A list of EC2 instance IDs to attach to the target group."
  type        = list(string)
}

variable "health_check_path" {
  description = "The path for the health check."
  type        = string
  default     = "/health"
}

variable "aws_region" {
  description = "The AWS region where resources are deployed."
  type        = string
}
