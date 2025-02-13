# Redis cluster primary endpoint for application configuration
output "redis_endpoint" {
  description = "Primary endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# Redis cluster port number for connection configuration
output "redis_port" {
  description = "Port number of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

# Security group ID for network access control
output "redis_security_group_id" {
  description = "Security group ID of the Redis cluster"
  value       = aws_security_group.redis.id
}

# Redis cluster reader endpoint for read replica access
output "redis_reader_endpoint" {
  description = "Reader endpoint for Redis read replicas"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}