# Terraform Configuration for Sales Intelligence Platform - Staging Environment
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
    bucket         = "sales-intelligence-platform-staging-tfstate"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = "us-east-1"
  
  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformExecutionRole"
  }

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "sales-intelligence-platform"
      ManagedBy   = "Terraform"
      Team        = "Platform Engineering"
    }
  }
}

# Kubernetes Provider Configuration
provider "kubernetes" {
  host                   = module.aws_infrastructure.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.aws_infrastructure.eks_cluster_ca_cert)
  token                 = module.aws_infrastructure.eks_token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
  }
}

# Core AWS Infrastructure Module
module "aws_infrastructure" {
  source = "../../aws"

  project_name = "sales-intelligence-platform"
  environment  = "staging"
  aws_region   = "us-east-1"
  
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]

  eks_cluster_version = "1.27"
  eks_node_groups = {
    general = {
      min_size       = 1
      max_size       = 3
      desired_size   = 2
      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
      disk_size      = 100
    }
    ai_workload = {
      min_size       = 1
      max_size       = 2
      desired_size   = 1
      instance_types = ["g4dn.xlarge"]
      capacity_type  = "SPOT"
      disk_size      = 150
    }
  }

  rds_instance_class           = "db.t3.large"
  rds_engine_version          = "15"
  rds_backup_retention_period = 7
  rds_multi_az               = true

  elasticache_node_type           = "cache.t3.medium"
  elasticache_num_nodes          = 2
  elasticache_automatic_failover = true

  enable_private_access = true
  enable_public_access = true
  cluster_log_types    = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  
  enable_monitoring     = true
  monitoring_interval  = 60
  backup_retention_period = 7
  enable_encryption    = true

  tags = {
    Project            = "Sales Intelligence Platform"
    Environment        = "staging"
    ManagedBy         = "Terraform"
    Team              = "Platform Engineering"
    CostCenter        = "CC-123456"
    DataClassification = "Confidential"
    Backup            = "Daily"
  }
}

# Outputs
output "vpc_id" {
  description = "VPC ID for reference by other resources and modules"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for Kubernetes provider and application configuration"
  value       = module.aws_infrastructure.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS cluster endpoint for database connections"
  value       = module.aws_infrastructure.rds_endpoint
}