variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
}

variable "instance_count" {
  description = "The number of EC2 instances to launch."
  type        = number
  default     = 2
}

variable "ami_id" {
  description = "The ID of the AMI to use for the EC2 instances."
  type        = string
}

variable "instance_type" {
  description = "The type of EC2 instance to launch."
  type        = string
  default     = "t3.micro"
}

variable "private_subnets" {
  description = "A list of private subnet IDs to launch the instances in."
  type        = list(string)
}

variable "app_security_group_id" {
  description = "The security group ID to associate with the EC2 instances."
  type        = string
}

variable "iam_instance_profile_name" {
  description = "The name of the IAM instance profile to attach to the instances."
  type        = string
}

variable "user_data" {
  description = "The user data script to run on instance launch."
  type        = string
  default     = null
}
