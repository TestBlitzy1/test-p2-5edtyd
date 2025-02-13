# AWS S3 Configuration for Sales Intelligence Platform
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

# Creative Assets Storage Bucket
resource "aws_s3_bucket" "assets" {
  bucket        = "${var.project_name}-${var.environment}-assets"
  force_destroy = var.environment != "prod"

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-assets"
    Purpose = "Creative Assets Storage"
  })
}

# Campaign Data Backups Bucket
resource "aws_s3_bucket" "backups" {
  bucket        = "${var.project_name}-${var.environment}-backups"
  force_destroy = var.environment != "prod"

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-backups"
    Purpose = "Campaign Data Backups"
  })
}

# Static Content Delivery Bucket
resource "aws_s3_bucket" "static_content" {
  bucket        = "${var.project_name}-${var.environment}-static"
  force_destroy = var.environment != "prod"

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-static"
    Purpose = "Static Content Delivery"
  })
}

# Versioning Configuration
resource "aws_s3_bucket_versioning" "assets_versioning" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "backups_versioning" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "static_versioning" {
  bucket = aws_s3_bucket.static_content.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle Rules
resource "aws_s3_bucket_lifecycle_rule" "assets_lifecycle" {
  bucket = aws_s3_bucket.assets.id
  id     = "assets-lifecycle"
  status = "Enabled"

  transition {
    days          = 90
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = 365
    storage_class = "GLACIER"
  }

  noncurrent_version_transition {
    noncurrent_days = 30
    storage_class   = "GLACIER"
  }
}

resource "aws_s3_bucket_lifecycle_rule" "backups_lifecycle" {
  bucket = aws_s3_bucket.backups.id
  id     = "backups-lifecycle"
  status = "Enabled"

  transition {
    days          = 30
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = 90
    storage_class = "GLACIER"
  }

  expiration {
    days = 365
  }
}

# Server-Side Encryption Configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "assets_encryption" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups_encryption" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_encryption" {
  bucket = aws_s3_bucket.static_content.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public Access Block Configuration
resource "aws_s3_bucket_public_access_block" "assets_public_access" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backups_public_access" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "static_public_access" {
  bucket = aws_s3_bucket.static_content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS Configuration for Static Content Bucket
resource "aws_s3_bucket_cors_configuration" "static_cors" {
  bucket = aws_s3_bucket.static_content.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Outputs
output "assets_bucket_name" {
  description = "Name of the S3 bucket for creative assets storage"
  value       = aws_s3_bucket.assets.id
}

output "backups_bucket_name" {
  description = "Name of the S3 bucket for campaign data backups"
  value       = aws_s3_bucket.backups.id
}

output "static_content_bucket_name" {
  description = "Name of the S3 bucket for static content delivery"
  value       = aws_s3_bucket.static_content.id
}