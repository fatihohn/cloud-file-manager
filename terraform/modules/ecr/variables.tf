variable "repository_name" {
  description = "The name of the ECR repository."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
  default     = "dev"
}
