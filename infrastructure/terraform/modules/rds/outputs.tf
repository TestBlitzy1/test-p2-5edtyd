# Connection Information
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "The hostname of the RDS instance"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "The port on which the DB accepts connections"
  value       = aws_db_instance.main.port
}

# Instance Information
output "db_instance_id" {
  description = "The RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "db_instance_status" {
  description = "The current status of the RDS instance"
  value       = aws_db_instance.main.status
}

# Database Information
output "db_name" {
  description = "The name of the database"
  value       = aws_db_instance.main.db_name
}

output "db_username" {
  description = "The master username for the database"
  value       = aws_db_instance.main.username
  sensitive   = true
}

# Network Information
output "db_subnet_group_name" {
  description = "The name of the DB subnet group"
  value       = aws_db_subnet_group.main.name
}

output "db_subnet_group_arn" {
  description = "The ARN of the DB subnet group"
  value       = aws_db_subnet_group.main.arn
}

# Monitoring Information
output "monitoring_role_arn" {
  description = "The ARN of the IAM role used for RDS enhanced monitoring"
  value       = aws_iam_role.rds_monitoring.arn
}

output "performance_insights_enabled" {
  description = "Whether Performance Insights is enabled"
  value       = aws_db_instance.main.performance_insights_enabled
}

# High Availability Information
output "availability_zone" {
  description = "The AZ where the RDS instance is deployed"
  value       = aws_db_instance.main.availability_zone
}

output "multi_az" {
  description = "Whether the RDS instance is multi-AZ"
  value       = aws_db_instance.main.multi_az
}

# Storage Information
output "allocated_storage" {
  description = "The allocated storage size in GB"
  value       = aws_db_instance.main.allocated_storage
}

output "storage_encrypted" {
  description = "Whether the storage is encrypted"
  value       = aws_db_instance.main.storage_encrypted
}

# Backup Information
output "backup_retention_period" {
  description = "The backup retention period in days"
  value       = aws_db_instance.main.backup_retention_period
}

output "latest_restorable_time" {
  description = "The latest time the database can be restored to"
  value       = aws_db_instance.main.latest_restorable_time
}

# Engine Information
output "engine_version" {
  description = "The running version of the database engine"
  value       = aws_db_instance.main.engine_version
}