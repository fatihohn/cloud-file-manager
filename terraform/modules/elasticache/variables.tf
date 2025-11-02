variable "name" {
  description = "A unique name for the ElastiCache cluster."
  type        = string
}

variable "vpc_id" {
  description = "The ID of the VPC where the ElastiCache cluster will be launched."
  type        = string
}

variable "private_subnets" {
  description = "A list of private subnet IDs for the ElastiCache cluster."
  type        = list(string)
}

variable "node_type" {
  description = "The instance type of the ElastiCache nodes."
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_clusters" {
  description = "The number of cache clusters (nodes) in the replication group."
  type        = number
  default     = 2
}

variable "redis_version" {
  description = "The version of Redis to use."
  type        = string
  default     = "6.x"
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
  default     = "dev"
}

variable "app_security_group_id" {
  description = "The security group ID of the application instances that need to access ElastiCache."
  type        = string
}
