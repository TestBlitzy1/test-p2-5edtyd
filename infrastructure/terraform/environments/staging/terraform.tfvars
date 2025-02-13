# Project Configuration
project_name = "sales-intelligence-platform"
environment  = "staging"
aws_region   = "us-east-1"

# Network Configuration
vpc_cidr            = "10.1.0.0/16"
availability_zones  = ["us-east-1a", "us-east-1b"]

# EKS Configuration
eks_cluster_version = "1.27"
eks_node_groups = {
  general = {
    instance_types = ["t3.large"]
    scaling_config = {
      desired_size = 2
      max_size     = 3
      min_size     = 1
    }
    labels = {
      workload = "general"
    }
    taints = []
  }
}

# RDS Configuration
rds_configuration = {
  instance_class               = "db.t3.large"
  engine_version              = "15.4"
  multi_az                    = true
  backup_retention_period     = 7
  performance_insights_enabled = true
}

# ElastiCache Configuration
elasticache_configuration = {
  node_type                  = "cache.t3.medium"
  num_cache_nodes           = 2
  parameter_group_family    = "redis7"
  engine_version           = "7.0"
  automatic_failover_enabled = true
}

# Access Configuration
enable_private_access = true
enable_public_access = true

# Logging Configuration
cluster_log_types = [
  "api",
  "audit",
  "authenticator",
  "controllerManager",
  "scheduler"
]

# Monitoring Configuration
monitoring_configuration = {
  metrics_enabled     = true
  logs_retention_days = 90
}

# Backup Configuration
backup_configuration = {
  enabled        = true
  retention_days = 14
}

# Resource Tags
tags = {
  Project     = "Sales Intelligence Platform"
  Environment = "staging"
  ManagedBy   = "Terraform"
  Team        = "Platform Engineering"
}