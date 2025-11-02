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

variable "vpc_cidr" {
  description = "The CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "A list of CIDR blocks for the public subnets."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "A list of CIDR blocks for the private subnets."
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "azs" {
  description = "A list of availability zones to use."
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2b"]
}
