# Main Terraform Configuration for Sales Intelligence Platform
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    # Backend configuration should be provided via backend config file
    key = "sales-intelligence-platform/terraform.tfstate"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

# VPC Module
module "vpc" {
  source = "./vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr          = var.vpc_cidr
  availability_zones = var.availability_zones
  tags              = var.tags
}

# EKS Module
module "eks" {
  source = "../modules/eks"

  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = var.eks_cluster_version
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  node_groups    = var.eks_node_groups

  enable_private_access = true
  enable_public_access = true
  cluster_log_types    = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = var.tags
}

# RDS Module
module "rds" {
  source = "../modules/rds"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids

  instance_class       = var.rds_configuration.instance_class
  engine_version      = var.rds_configuration.engine_version
  multi_az           = var.rds_configuration.multi_az
  backup_retention_period = var.rds_configuration.backup_retention_period

  performance_insights_enabled = var.rds_configuration.performance_insights_enabled
  deletion_protection         = true
  storage_encrypted          = true

  tags = var.tags
}

# ElastiCache Module
module "elasticache" {
  source = "../modules/elasticache"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids

  node_type                  = var.elasticache_configuration.node_type
  num_cache_nodes           = var.elasticache_configuration.num_cache_nodes
  parameter_group_family    = var.elasticache_configuration.parameter_group_family
  engine_version           = var.elasticache_configuration.engine_version
  automatic_failover_enabled = var.elasticache_configuration.automatic_failover_enabled

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = var.tags
}

# CloudWatch Log Groups for Application Logs
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/${var.project_name}/${var.environment}/application"
  retention_in_days = var.monitoring_configuration.logs_retention_days

  tags = var.tags
}

# S3 Bucket for Application Assets
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-${var.environment}-assets"

  tags = var.tags
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "Endpoint for RDS cluster"
  value       = module.rds.endpoint
}

output "elasticache_endpoint" {
  description = "Endpoint for ElastiCache cluster"
  value       = module.elasticache.endpoint
}

output "assets_bucket_name" {
  description = "Name of the S3 bucket for assets"
  value       = aws_s3_bucket.assets.id
}