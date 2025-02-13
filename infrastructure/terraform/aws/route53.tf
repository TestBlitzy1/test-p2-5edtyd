# AWS Route53 Configuration for Sales Intelligence Platform
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

# Primary Hosted Zone
resource "aws_route53_zone" "main" {
  name          = "${var.project_name}-${var.environment}.com"
  comment       = "Primary hosted zone for ${var.project_name} ${var.environment} environment"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-${var.environment}-zone"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    CreatedAt   = timestamp()
  }
}

# CloudFront Distribution DNS Record
resource "aws_route53_record" "cloudfront_alias" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = "Z2FDTNDATAQYW2" # CloudFront's fixed zone ID
    evaluate_target_health = true
  }

  depends_on = [aws_route53_health_check.cloudfront]
}

# CloudFront Health Check
resource "aws_route53_health_check" "cloudfront" {
  fqdn              = var.cloudfront_domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  measure_latency   = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-cloudfront-health"
    Environment = var.environment
  }
}

# Apex Domain Record
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = ""
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = "Z2FDTNDATAQYW2" # CloudFront's fixed zone ID
    evaluate_target_health = true
  }
}

# ACM Certificate Validation Records
resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Regional API Gateway Records
resource "aws_route53_record" "api" {
  for_each = toset(["us-east-1", "eu-west-1", "ap-southeast-1"])

  zone_id = aws_route53_zone.main.zone_id
  name    = "api-${each.key}"
  type    = "A"

  alias {
    name                   = "execute-api.${each.key}.amazonaws.com"
    zone_id               = data.aws_api_gateway_domain_name.regional[each.key].regional_zone_id
    evaluate_target_health = true
  }
}

# Latency-Based Routing Policy for API
resource "aws_route53_record" "api_latency" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api"
  type    = "A"

  latency_routing_policy {
    region = var.aws_region
  }

  alias {
    name                   = "execute-api.${var.aws_region}.amazonaws.com"
    zone_id               = data.aws_api_gateway_domain_name.regional[var.aws_region].regional_zone_id
    evaluate_target_health = true
  }

  set_identifier = var.aws_region
}

# DNS-Based Health Checks for Regional Endpoints
resource "aws_route53_health_check" "regional_api" {
  for_each = toset(["us-east-1", "eu-west-1", "ap-southeast-1"])

  fqdn              = "api-${each.key}.${aws_route53_zone.main.name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  regions          = ["us-west-1", "eu-west-1", "ap-southeast-1"]

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-health-${each.key}"
    Environment = var.environment
    Region      = each.key
  }
}

# Outputs
output "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS management"
  value       = aws_route53_zone.main.zone_id
}

output "domain_name" {
  description = "Primary domain name for the application"
  value       = aws_route53_zone.main.name
}

output "nameservers" {
  description = "Nameservers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
}