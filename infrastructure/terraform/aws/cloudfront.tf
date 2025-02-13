# AWS CloudFront Configuration for Sales Intelligence Platform
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "${var.project_name}-${var.environment} OAI"
}

# CloudFront Cache Policy for Static Content
resource "aws_cloudfront_cache_policy" "static_content" {
  name        = "${var.project_name}-${var.environment}-static-content"
  comment     = "Cache policy for static content delivery"
  default_ttl = 86400  # 24 hours
  max_ttl     = 31536000  # 365 days
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment} static content distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  wait_for_deployment = true

  # Origin configuration for S3
  origin {
    domain_name = aws_s3_bucket.static_content.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.static_content.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.static_content.id}"
    compress         = true

    cache_policy_id = aws_cloudfront_cache_policy.static_content.id

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
  }

  # Custom error responses
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # Web Application Firewall integration
  web_acl_id = aws_wafv2_web_acl.cloudfront.arn

  # Logging configuration
  logging_config {
    include_cookies = false
    bucket         = "${aws_s3_bucket.static_content.bucket_domain_name}"
    prefix         = "cloudfront-logs/"
  }

  # Tags
  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-cf-distribution"
    Environment = var.environment
    Service     = "CloudFront"
  })
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.static_content.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.main.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_content.arn}/*"
      }
    ]
  })
}

# Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "Route 53 hosted zone ID for the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}