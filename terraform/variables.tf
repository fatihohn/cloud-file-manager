variable "project_name" {
  description = "The name of the project."
  type        = string
  default     = "cloud-file-manager"
}

variable "vpc_cidr" {
  description = "The CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "ap-northeast-2"
}

variable "db_name" {
  description = "The name of the RDS database to create."
  type        = string
  default     = "cloudfilemanager"
}

variable "db_username" {
  description = "The master username for the RDS database."
  type        = string
  default     = "cloudfilemanager"
}

variable "db_password" {
  description = "The password for the RDS database master user."
  type        = string
  sensitive   = true
}

variable "jwt_access_secret" {
  description = "The secret key for signing JWT access tokens."
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "The secret key for signing JWT refresh tokens."
  type        = string
  sensitive   = true
}

variable "jwt_access_expiration" {
  description = "Expiration time for JWT access tokens (e.g., 30m)."
  type        = string
  default     = "30m"
}

variable "jwt_refresh_expiration" {
  description = "Expiration time for JWT refresh tokens (e.g., 1h)."
  type        = string
  default     = "1h"
}

variable "file_name_encryption_key" {
  description = "A base64-encoded 32-byte key for encrypting file names."
  type        = string
  sensitive   = true
}

variable "bullmq_attempts" {
  description = "Number of attempts for BullMQ jobs."
  type        = number
  default     = 3
}

variable "bullmq_backoff_delay" {
  description = "Backoff delay for BullMQ jobs in milliseconds."
  type        = number
  default     = 1000
}

variable "bullmq_remove_on_complete" {
  description = "Number of jobs to keep after completion."
  type        = number
  default     = 50
}

variable "bullmq_remove_on_fail" {
  description = "Number of jobs to keep after failure."
  type        = number
  default     = 100
}

variable "redis_port" {
  description = "The port for the Redis server."
  type        = number
  default     = 6379
}

variable "max_upload_bytes" {
  description = "Maximum upload size in bytes."
  type        = number
  default     = 1073741824
}

variable "files_download_url_ttl_seconds" {
  description = "TTL for file download presigned URLs in seconds."
  type        = number
  default     = 300
}
