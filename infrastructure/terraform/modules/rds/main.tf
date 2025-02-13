# AWS RDS PostgreSQL Module
# Terraform AWS Provider Version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  db_name             = "${var.project_name}_${var.environment}"
  db_identifier       = "${var.project_name}-${var.environment}-postgresql"
  backup_window       = "03:00-04:00"
  maintenance_window  = "Mon:04:00-Mon:05:00"
}

# DB subnet group for RDS instance placement
resource "aws_db_subnet_group" "main" {
  name        = "${local.db_identifier}-subnet-group"
  subnet_ids  = var.subnet_ids
  
  tags = merge(
    {
      Name        = "${local.db_identifier}-subnet-group"
      Environment = var.environment
    },
    var.tags
  )
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${local.db_identifier}-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    {
      Name        = "${local.db_identifier}-monitoring-role"
      Environment = var.environment
    },
    var.tags
  )
}

# Attach enhanced monitoring policy to IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Main RDS PostgreSQL instance
resource "aws_db_instance" "main" {
  identifier = local.db_identifier
  
  # Engine configuration
  engine                      = "postgres"
  engine_version              = var.engine_version
  instance_class             = var.instance_class
  
  # Storage configuration
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.max_allocated_storage
  storage_encrypted         = var.storage_encrypted
  storage_type              = "gp3"
  
  # Database configuration
  db_name                   = local.db_name
  username                  = var.db_username
  password                  = var.db_password
  
  # Network configuration
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = var.vpc_security_group_ids
  publicly_accessible       = false
  
  # High availability configuration
  multi_az                  = var.multi_az
  availability_zone         = null  # AWS chooses optimal AZ
  
  # Backup configuration
  backup_retention_period   = var.backup_retention_period
  backup_window            = local.backup_window
  maintenance_window       = local.maintenance_window
  copy_tags_to_snapshot    = true
  
  # Performance and monitoring
  monitoring_interval      = var.monitoring_interval
  monitoring_role_arn     = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # Security configuration
  deletion_protection      = var.deletion_protection
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.db_identifier}-final-snapshot"
  
  # Parameter group configuration
  parameter_group_name    = "default.postgres${split(".", var.engine_version)[0]}"
  
  # Auto minor version upgrades
  auto_minor_version_upgrade = true
  
  tags = merge(
    {
      Name        = local.db_identifier
      Environment = var.environment
    },
    var.tags
  )

  # Lifecycle policies
  lifecycle {
    prevent_destroy = true
    
    ignore_changes = [
      password,
      snapshot_identifier
    ]
  }
}

# Outputs
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_id" {
  description = "The identifier of the RDS instance"
  value       = aws_db_instance.main.id
}

output "db_subnet_group_name" {
  description = "The name of the database subnet group"
  value       = aws_db_subnet_group.main.name
}