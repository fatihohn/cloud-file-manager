variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)."
  type        = string
}

variable "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer (ALB) to integrate with."
  type        = string
}
