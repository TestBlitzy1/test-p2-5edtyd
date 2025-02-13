# Project Information Output
output "project_info" {
  description = "Project and environment information"
  value = {
    project_name = var.project_name
    environment  = var.environment
    region      = var.aws_region
    tags        = var.tags
  }
}

# VPC and Network Outputs
output "vpc_outputs" {
  description = "VPC and subnet information"
  value = {
    vpc_id             = module.vpc.vpc_id
    private_subnet_ids = module.vpc.private_subnet_ids
    public_subnet_ids  = module.vpc.public_subnet_ids
    availability_zones = var.availability_zones
  }
}

# EKS Cluster Outputs
output "eks_outputs" {
  description = "EKS cluster information"
  value = {
    cluster_name              = module.eks.cluster_id
    cluster_endpoint         = module.eks.cluster_endpoint
    cluster_security_group_id = module.eks.cluster_security_group_id
    cluster_version          = var.eks_cluster_version
    node_group_roles         = module.eks.node_group_role_arn
  }
}

# RDS Database Outputs
output "database_outputs" {
  description = "RDS database connection information"
  sensitive   = true
  value = {
    rds_endpoint          = module.rds.endpoint
    rds_port             = module.rds.port
    rds_name             = module.rds.db_name
    rds_security_group_id = module.rds.security_group_id
    rds_subnet_group_name = module.rds.subnet_group_name
  }
}

# ElastiCache Outputs
output "cache_outputs" {
  description = "ElastiCache connection information"
  sensitive   = true
  value = {
    elasticache_endpoint               = module.elasticache.endpoint
    elasticache_port                  = module.elasticache.port
    elasticache_security_group_id      = module.elasticache.security_group_id
    elasticache_subnet_group_name      = module.elasticache.subnet_group_name
    elasticache_configuration_endpoint = module.elasticache.configuration_endpoint
    elasticache_cluster_mode          = module.elasticache.cluster_mode_enabled
  }
}

# Network Security Outputs
output "security_outputs" {
  description = "Security group and network access information"
  value = {
    vpc_security_group_ids = [
      module.eks.cluster_security_group_id,
      module.rds.security_group_id,
      module.elasticache.security_group_id
    ]
    private_network_cidr = var.vpc_cidr
  }
}

# Monitoring and Logging Outputs
output "monitoring_outputs" {
  description = "Monitoring and logging configuration"
  value = {
    metrics_enabled     = var.monitoring_configuration.metrics_enabled
    logs_retention_days = var.monitoring_configuration.logs_retention_days
    backup_enabled      = var.backup_configuration.enabled
    backup_retention    = var.backup_configuration.retention_days
  }
}

# Resource Tags Output
output "resource_tags" {
  description = "Common resource tags"
  value = merge(
    var.tags,
    {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
}