# Development Environment Terraform Configuration
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0, hashicorp/kubernetes ~> 2.0

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
    bucket         = "sales-intelligence-platform-tfstate-dev"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock-dev"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "dev"
      ManagedBy   = "Terraform"
      Project     = var.project_name
      CostCenter  = "development"
    }
  }
}

# Kubernetes Provider Configuration
provider "kubernetes" {
  host                   = module.aws_infrastructure.eks_cluster_endpoint
  cluster_ca_certificate = module.aws_infrastructure.eks_cluster_ca_cert
  token                  = module.aws_infrastructure.eks_token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
  }
}

# AWS Infrastructure Module
module "aws_infrastructure" {
  source = "../../aws"

  # Project Configuration
  project_name = var.project_name
  environment  = "dev"
  aws_region   = var.aws_region

  # Network Configuration
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  # EKS Configuration
  eks_cluster_version = "1.27"
  eks_node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size      = 1
      max_size      = 3
      desired_size  = 1
    }
  }

  # Database Configuration
  rds_instance_class    = "db.t3.medium"
  rds_engine_version    = "15.4"
  elasticache_node_type = "cache.t3.micro"
  elasticache_num_nodes = 1

  # Monitoring Configuration
  enable_monitoring        = true
  backup_retention_period = 7

  # Resource Tags
  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
    Project     = var.project_name
    CostCenter  = "development"
  }
}

# Outputs
output "vpc_id" {
  description = "VPC ID for reference by applications and security groups"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for application deployment and kubectl access"
  value       = module.aws_infrastructure.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint for database connections from applications"
  value       = module.aws_infrastructure.rds_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint for caching services and session management"
  value       = module.aws_infrastructure.elasticache_endpoint
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for development environment monitoring"
  value       = module.aws_infrastructure.monitoring_dashboard_url
}