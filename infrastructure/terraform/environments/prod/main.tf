# Production Environment Terraform Configuration for Sales Intelligence Platform
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
    bucket               = "sales-intelligence-platform-tfstate-prod"
    key                  = "prod/terraform.tfstate"
    region              = "us-east-1"
    encrypt             = true
    dynamodb_table      = "terraform-lock-prod"
    kms_key_id          = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/tfstate-key"
    versioning          = true
    server_side_encryption = "aws:kms"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Project     = "Sales Intelligence Platform"
      Environment = "Production"
      ManagedBy   = "Terraform"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformProductionRole"
  }
}

# Kubernetes Provider Configuration
provider "kubernetes" {
  host                   = module.aws_infrastructure.eks_cluster_endpoint
  cluster_ca_certificate = module.aws_infrastructure.eks_cluster_ca_cert
  token                 = module.aws_infrastructure.eks_token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.aws_infrastructure.eks_cluster_name]
  }
}

# Main AWS Infrastructure Module
module "aws_infrastructure" {
  source = "../../aws"

  project_name = "sales-intelligence-platform"
  environment  = "prod"
  aws_region   = "us-east-1"
  vpc_cidr     = "10.0.0.0/16"
  
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  
  eks_cluster_version = "1.27"
  eks_node_groups = {
    general = {
      min_size       = 3
      max_size       = 10
      desired_size   = 5
      instance_types = ["t3.xlarge"]
      capacity_type  = "ON_DEMAND"
      disk_size      = 100
      enable_monitoring = true
    }
    cpu_optimized = {
      min_size       = 2
      max_size       = 8
      desired_size   = 3
      instance_types = ["c6i.2xlarge"]
      capacity_type  = "ON_DEMAND"
      disk_size      = 100
      enable_monitoring = true
    }
    memory_optimized = {
      min_size       = 2
      max_size       = 6
      desired_size   = 3
      instance_types = ["r6i.2xlarge"]
      capacity_type  = "ON_DEMAND"
      disk_size      = 100
      enable_monitoring = true
    }
  }

  rds_instance_class = "db.r6i.2xlarge"
  rds_engine_version = "15.3"
  rds_multi_az      = true
  rds_backup_retention = 30
  rds_performance_insights_enabled = true

  elasticache_node_type = "cache.r6g.xlarge"
  elasticache_num_nodes = 3
  elasticache_automatic_failover = true
  elasticache_cluster_mode = true

  tags = {
    Project            = "Sales Intelligence Platform"
    Environment        = "Production"
    ManagedBy         = "Terraform"
    BusinessUnit      = "Digital Marketing"
    CostCenter        = "PROD-001"
    DataClassification = "Confidential"
    Compliance        = "SOC2"
    BackupSchedule    = "Daily"
    DisasterRecovery  = "Tier1"
  }
}

# Outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Production EKS cluster endpoint"
  value       = module.aws_infrastructure.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.aws_infrastructure.rds_endpoint
}

output "elasticache_endpoint" {
  description = "Production ElastiCache endpoint"
  value       = module.aws_infrastructure.elasticache_endpoint
}