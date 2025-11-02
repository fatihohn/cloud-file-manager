output "alb_dns_name" {
  description = "The DNS name of the ALB."
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "The ARN of the ALB."
  value       = aws_lb.main.arn
}

output "alb_security_group_id" {
  description = "The ID of the security group created for the ALB."
  value       = aws_security_group.alb_sg.id
}
