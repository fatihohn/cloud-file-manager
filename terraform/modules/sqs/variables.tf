variable "queue_name" {
  description = "The name of the SQS queue."
  type        = string
}

variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, prod)."
  type        = string
}
