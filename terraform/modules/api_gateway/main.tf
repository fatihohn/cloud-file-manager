resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-${var.environment}-api"
  description = "API Gateway for ${var.project_name} application"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api"
  }
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_method" "root_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_method.http_method
  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  connection_type         = "INTERNET"
  uri                     = "http://${var.alb_dns_name}/{proxy}" # ALB DNS name with proxy path
}

resource "aws_api_gateway_integration" "root_integration" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_rest_api.main.root_resource_id
  http_method             = aws_api_gateway_method.root_method.http_method
  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  connection_type         = "INTERNET"
  uri                     = "http://${var.alb_dns_name}"
}

resource "aws_api_gateway_resource" "docs" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "docs"
}

resource "aws_api_gateway_method" "docs_get_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.docs.id
  http_method   = "GET"
  authorization = "NONE"
  api_key_required = false # API Key not required for docs
}

resource "aws_api_gateway_integration" "docs_get_integration" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.docs.id
  http_method             = aws_api_gateway_method.docs_get_method.http_method
  integration_http_method = "GET"
  type                    = "HTTP_PROXY"
  connection_type         = "INTERNET"
  uri                     = "http://${var.alb_dns_name}/docs"
}

resource "aws_api_gateway_resource" "docs_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.docs.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "docs_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.docs_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
  api_key_required = false # API Key not required for docs sub-paths
}

resource "aws_api_gateway_integration" "docs_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.docs_proxy.id
  http_method             = aws_api_gateway_method.docs_proxy_method.http_method
  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  connection_type         = "INTERNET"
  uri                     = "http://${var.alb_dns_name}/docs/{proxy}"
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  triggers = {
    redeployment = sha1(jsonencode({
      rest_api_body = aws_api_gateway_rest_api.main.body
      method_settings = aws_api_gateway_method.proxy_method
      root_method_settings = aws_api_gateway_method.root_method
      integration_settings = aws_api_gateway_integration.proxy_integration
      root_integration_settings = aws_api_gateway_integration.root_integration
      docs_method_settings = aws_api_gateway_method.docs_get_method
      docs_integration_settings = aws_api_gateway_integration.docs_get_integration
      docs_proxy_method_settings = aws_api_gateway_method.docs_proxy_method
      docs_proxy_integration_settings = aws_api_gateway_integration.docs_proxy_integration
    }))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.proxy_integration,
    aws_api_gateway_integration.root_integration,
    aws_api_gateway_integration.docs_get_integration,
    aws_api_gateway_integration.docs_proxy_integration,
    aws_api_gateway_method.proxy_method,
    aws_api_gateway_method.root_method,
    aws_api_gateway_method.docs_get_method,
    aws_api_gateway_method.docs_proxy_method,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment
}

resource "aws_api_gateway_api_key" "main" {
  name        = "${var.project_name}-${var.environment}-api-key"
  description = "API Key for ${var.project_name} ${var.environment} environment"
  enabled     = true
}

resource "aws_api_gateway_usage_plan" "main" {
  name        = "${var.project_name}-${var.environment}-usage-plan"
  description = "Usage plan for ${var.project_name} ${var.environment} API"

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }
}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.main.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.main.id
}

