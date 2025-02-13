# AWS ElastiCache Redis Module
# Provider version: ~> 5.0
# Redis version: 7.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  redis_family = "redis7.0"
  redis_port   = "6379"
  redis_parameters = [
    {
      name  = "maxmemory-policy"
      value = "allkeys-lru"
    },
    {
      name  = "maxmemory-samples"
      value = "10"
    },
    {
      name  = "timeout"
      value = "300"
    },
    {
      name  = "tcp-keepalive"
      value = "300"
    }
  ]
}

# Subnet group for Redis cluster network isolation
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.cluster_name}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for Redis cluster ${var.cluster_name}"
  tags        = var.tags
}

# Parameter group for Redis configuration optimization
resource "aws_elasticache_parameter_group" "redis" {
  family      = local.redis_family
  name        = "${var.cluster_name}-params"
  description = "Optimized Redis parameters for ${var.cluster_name}"

  dynamic "parameter" {
    for_each = local.redis_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  tags = var.tags
}

# Security group for Redis network access control
resource "aws_security_group" "redis" {
  name        = "${var.cluster_name}-sg"
  vpc_id      = var.vpc_id
  description = "Security group for Redis cluster ${var.cluster_name}"

  ingress {
    from_port   = local.redis_port
    to_port     = local.redis_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Allow Redis traffic"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound traffic"
  }

  tags = var.tags
}

# High-availability Redis replication group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = var.cluster_name
  description         = "High-availability Redis cluster for ${var.cluster_name}"
  node_type           = var.node_type
  num_cache_clusters  = var.num_cache_nodes
  port                = local.redis_port

  # Network configuration
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true

  # Encryption configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  # Maintenance settings
  maintenance_window       = var.maintenance_window
  snapshot_window         = var.snapshot_window
  snapshot_retention_limit = var.snapshot_retention_limit

  # Engine configuration
  engine         = "redis"
  engine_version = "7.0"

  # Operational settings
  apply_immediately          = true
  auto_minor_version_upgrade = true

  tags = var.tags
}

# Output values for other modules
output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster access"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for read replicas"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port number for Redis cluster access"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_security_group_id" {
  description = "Security group ID for network access control"
  value       = aws_security_group.redis.id
}