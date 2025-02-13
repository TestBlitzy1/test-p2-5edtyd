# AWS Infrastructure Variables Configuration
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

# Project Configuration
variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming and tagging"
  default     = "sales-intelligence-platform"

  validation {
    condition     = length(var.project_name) <= 32
    error_message = "Project name must be 32 characters or less"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment"
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d$", var.aws_region))
    error_message = "AWS region must be in valid format (e.g., us-east-1)"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be in valid format"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones suffixes for multi-AZ deployment"
  default     = ["a", "b", "c"]
}

# EKS Configuration
variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.27"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be in format X.Y"
  }
}

variable "eks_node_groups" {
  type = map(object({
    instance_types = list(string)
    scaling_config = object({
      desired_size = number
      max_size     = number
      min_size     = number
    })
    labels = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Configuration for EKS node groups including instance types, scaling, labels, and taints"
  default = {
    general = {
      instance_types = ["t3.large"]
      scaling_config = {
        desired_size = 3
        max_size     = 10
        min_size     = 1
      }
      labels = {
        workload = "general"
      }
      taints = []
    }
    cpu_optimized = {
      instance_types = ["c6i.xlarge"]
      scaling_config = {
        desired_size = 2
        max_size     = 8
        min_size     = 1
      }
      labels = {
        workload = "cpu-optimized"
      }
      taints = [
        {
          key    = "workload"
          value  = "ai-processing"
          effect = "NoSchedule"
        }
      ]
    }
  }
}

# RDS Configuration
variable "rds_configuration" {
  type = object({
    instance_class               = string
    engine_version              = string
    multi_az                    = bool
    backup_retention_period     = number
    performance_insights_enabled = bool
  })
  description = "Configuration for RDS PostgreSQL instances"
  default = {
    instance_class               = "db.t3.large"
    engine_version              = "15.4"
    multi_az                    = true
    backup_retention_period     = 7
    performance_insights_enabled = true
  }
}

# ElastiCache Configuration
variable "elasticache_configuration" {
  type = object({
    node_type                  = string
    num_cache_nodes           = number
    parameter_group_family    = string
    engine_version           = string
    automatic_failover_enabled = bool
  })
  description = "Configuration for ElastiCache Redis cluster"
  default = {
    node_type                  = "cache.t3.medium"
    num_cache_nodes           = 3
    parameter_group_family    = "redis7"
    engine_version           = "7.0"
    automatic_failover_enabled = true
  }
}

# Backup Configuration
variable "backup_configuration" {
  type = object({
    enabled        = bool
    retention_days = number
  })
  description = "Configuration for backup policies"
  default = {
    enabled        = true
    retention_days = 30
  }
}

# Monitoring Configuration
variable "monitoring_configuration" {
  type = object({
    metrics_enabled     = bool
    logs_retention_days = number
  })
  description = "Configuration for monitoring and logging"
  default = {
    metrics_enabled     = true
    logs_retention_days = 90
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default     = {}
}