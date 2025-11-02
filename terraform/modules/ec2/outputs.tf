output "instance_ids" {
  description = "A list of the IDs of the launched EC2 instances."
  value       = aws_instance.app_instance[*].id
}
