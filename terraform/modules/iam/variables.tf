variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
}

variable "s3_bucket_arn" {
  description = "The ARN of the S3 bucket that EC2 instances need to access."
  type        = string
}

variable "secrets_manager_arns" {
  description = "A list of ARNs for the secrets that the EC2 role needs to access."
  type        = list(string)
  default     = []
}
