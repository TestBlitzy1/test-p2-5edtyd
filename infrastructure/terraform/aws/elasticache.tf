# AWS ElastiCache Redis Configuration
# Provider: hashicorp/aws ~> 5.0
# Redis Version: 7.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for Redis configuration
locals {
  redis_name              = "${var.project_name}-${var.environment}-redis"
  redis_family           = "redis7.0"
  redis_port             = "6379"
  redis_maintenance_window = "sun:05:00-sun:07:00"
  redis_snapshot_window   = "03:00-05:00"
}

# Redis cluster deployment using the elasticache module
module "redis" {
  source = "../modules/elasticache"

  # Cluster identification
  cluster_name = local.redis_name

  # Instance configuration
  node_type       = var.elasticache_configuration.node_type
  num_cache_nodes = var.elasticache_configuration.num_cache_nodes
  engine_version  = local.redis_family

  # Network configuration
  port        = local.redis_port
  subnet_ids  = module.vpc.private_subnet_ids
  vpc_id      = module.vpc.vpc_id
  allowed_cidr_blocks = [var.vpc_cidr] # Allow access only from within VPC

  # High availability configuration
  multi_az_enabled           = true
  automatic_failover_enabled = true

  # Security configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  # Maintenance configuration
  maintenance_window      = local.redis_maintenance_window
  snapshot_window        = local.redis_snapshot_window
  snapshot_retention_limit = 7

  # Redis parameter group configuration
  parameter_group_family = local.redis_family

  # Resource tagging
  tags = merge(var.tags, {
    Name                = local.redis_name
    Environment         = var.environment
    Project            = var.project_name
    ManagedBy          = "terraform"
    SecurityCompliance = "soc2"
    Service            = "cache"
    CostCenter         = "infrastructure"
  })
}

# Output values for other modules and resources
output "redis_endpoint" {
  description = "Primary endpoint of the Redis cluster for application configuration"
  value       = module.redis.redis_endpoint
}

output "redis_port" {
  description = "Port number of the Redis cluster for application connectivity"
  value       = module.redis.redis_port
}

output "redis_security_group_id" {
  description = "Security group ID of the Redis cluster for network access control"
  value       = module.redis.redis_security_group_id
}