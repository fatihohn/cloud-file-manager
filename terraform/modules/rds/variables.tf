variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
}

variable "vpc_id" {
  description = "The ID of the VPC where the RDS instance will be launched."
  type        = string
}

variable "private_subnets" {
  description = "A list of private subnet IDs for the RDS instance."
  type        = list(string)
}

variable "app_security_group_id" {
  description = "The security group ID of the application instances that need to access RDS."
  type        = string
}

variable "db_name" {
  description = "The name of the database to create."
  type        = string
  default     = "cloudfilemanager"
}

variable "db_username" {
  description = "The username for the database master user."
  type        = string
  default     = "cloudfilemanager"
}

variable "db_password" {
  description = "The password for the database master user."
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "The instance type of the RDS instance."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "The allocated storage in gigabytes."
  type        = number
  default     = 20
}
