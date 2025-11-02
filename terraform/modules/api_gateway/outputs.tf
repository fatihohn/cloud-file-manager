output "invoke_url" {
  description = "The invoke URL of the API Gateway stage."
  value       = aws_api_gateway_stage.main.invoke_url
}

output "api_key_value" {
  description = "The value of the generated API Key."
  value       = aws_api_gateway_api_key.main.value
  sensitive   = true
}
