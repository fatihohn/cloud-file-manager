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

# OPTIONS method for root resource (CORS preflight)
resource "aws_api_gateway_method" "root_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options_method.http_method
  type        = "MOCK" # Mock integration for OPTIONS
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "root_options_response" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "root_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.root_options_method.http_method
  status_code = aws_api_gateway_method_response.root_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method.root_options_method]
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

  request_parameters = {
    "integration.request.header.Content-Type" = "'application/json'"
    "integration.request.header.Accept"       = "'*/*'"
    "integration.request.header.Host"         = "'${var.alb_dns_name}'"
    "integration.request.header.User-Agent"   = "'$input.params('User-Agent')'"
    "integration.request.header.X-Forwarded-For" = "'$input.params('X-Forwarded-For')'"
    "integration.request.header.X-Forwarded-Proto" = "'$input.params('X-Forwarded-Proto')'"
    "integration.request.header.X-Forwarded-Port" = "'$input.params('X-Forwarded-Port')'"
  }
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
      root_options_method = aws_api_gateway_method.root_options_method
      root_options_integration = aws_api_gateway_integration.root_options_integration
      root_options_response = aws_api_gateway_method_response.root_options_response
      root_options_integration_response = aws_api_gateway_integration_response.root_options_integration_response
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
    aws_api_gateway_method.root_options_method,
    aws_api_gateway_integration.root_options_integration,
    aws_api_gateway_method_response.root_options_response,
    aws_api_gateway_integration_response.root_options_integration_response,
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

