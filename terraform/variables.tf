variable "project_name" {
  description = "The name of the project."
  type        = string
  default     = "cloud-file-manager"
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