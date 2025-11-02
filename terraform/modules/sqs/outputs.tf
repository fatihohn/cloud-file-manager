output "queue_url" {
  description = "The URL of the SQS queue."
  value       = aws_sqs_queue.main.id # .id attribute returns the URL for SQS queues
}
