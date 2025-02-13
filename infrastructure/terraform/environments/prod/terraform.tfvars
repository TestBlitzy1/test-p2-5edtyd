# Production Environment Terraform Variables
# Provider: hashicorp/aws ~> 5.0

# Project Identification
project_name = "sales-intelligence-platform"
environment  = "prod"

# Regional Configuration
aws_region = "us-east-1"
vpc_cidr   = "10.0.0.0/16"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# EKS Cluster Configuration
eks_cluster_version = "1.27"

eks_node_groups = {
  general = {
    instance_types = ["t3.xlarge"]
    scaling_config = {
      desired_size = 5
      max_size     = 10
      min_size     = 3
    }
    labels = {
      workload = "general"
    }
    taints = []
  }
  cpu_optimized = {
    instance_types = ["c6i.2xlarge"]
    scaling_config = {
      desired_size = 3
      max_size     = 8
      min_size     = 2
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
  memory_optimized = {
    instance_types = ["r6i.2xlarge"]
    scaling_config = {
      desired_size = 3
      max_size     = 6
      min_size     = 2
    }
    labels = {
      workload = "memory-optimized"
    }
    taints = [
      {
        key    = "workload"
        value  = "data-processing"
        effect = "NoSchedule"
      }
    ]
  }
}

# RDS Configuration
rds_configuration = {
  instance_class               = "db.r6i.2xlarge"
  engine_version              = "15.3"
  multi_az                    = true
  backup_retention_period     = 30
  performance_insights_enabled = true
}

# ElastiCache Configuration
elasticache_configuration = {
  node_type                  = "cache.r6g.xlarge"
  num_cache_nodes           = 3
  parameter_group_family    = "redis7"
  engine_version           = "7.0"
  automatic_failover_enabled = true
}

# Backup Configuration
backup_configuration = {
  enabled        = true
  retention_days = 30
}

# Monitoring Configuration
monitoring_configuration = {
  metrics_enabled     = true
  logs_retention_days = 90
}

# Resource Tags
tags = {
  Project            = "Sales Intelligence Platform"
  Environment        = "Production"
  ManagedBy         = "Terraform"
  BusinessUnit      = "Digital Marketing"
  CostCenter        = "PROD-001"
  DataClassification = "Confidential"
}