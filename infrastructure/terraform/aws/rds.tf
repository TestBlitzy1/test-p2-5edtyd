# AWS RDS PostgreSQL Configuration
# Provider: hashicorp/aws ~> 5.0
# Purpose: Provisions and manages RDS PostgreSQL instances with high availability and security

# Import required variables from variables.tf
variable "project_name" {
  type        = string
  description = "Project name for resource naming"
}

variable "environment" {
  type        = string
  description = "Deployment environment specification"
}

variable "rds_instance_class" {
  type        = string
  description = "RDS instance type configuration"
  default     = "db.t3.large"
}

variable "rds_credentials_secret_name" {
  type        = string
  description = "AWS Secrets Manager secret name containing RDS credentials"
}

# Local variables for resource naming
locals {
  db_name       = "${var.project_name}_${var.environment}"
  db_identifier = "${var.project_name}-${var.environment}-postgresql"
}

# RDS PostgreSQL instance configuration
module "rds" {
  source = "../modules/rds"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids

  # Instance configuration
  instance_class    = var.rds_instance_class
  engine_version    = "15.4"
  allocated_storage = 100
  max_allocated_storage = 1000

  # High availability configuration
  multi_az = true

  # Security configuration
  storage_encrypted = true
  
  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Monitoring configuration
  performance_insights_enabled           = true
  performance_insights_retention_period  = 7
  monitoring_interval                    = 60
  enabled_cloudwatch_logs_exports        = ["postgresql", "upgrade"]

  # Database credentials from AWS Secrets Manager
  db_username = data.aws_secretsmanager_secret_version.rds_credentials.db_username
  db_password = data.aws_secretsmanager_secret_version.rds_credentials.db_password

  # Network security
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Resource tags
  tags = {
    Name        = local.db_identifier
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    CostCenter  = "database"
    Compliance  = "gdpr"
  }
}

# Security group for RDS instance
resource "aws_security_group" "rds" {
  name        = "${local.db_identifier}-sg"
  description = "Security group for RDS PostgreSQL instance"
  vpc_id      = module.vpc.vpc_id

  # Inbound rule for PostgreSQL access from EKS workers
  ingress {
    description     = "PostgreSQL access from EKS workers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.worker_security_group_id]
  }

  # Outbound rule allowing all traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-rds-sg"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Data source for RDS credentials from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "rds_credentials" {
  secret_id = var.rds_credentials_secret_name
}

# Output values for other modules
output "rds_endpoint" {
  description = "RDS instance endpoint for application configuration"
  value       = module.rds.endpoint
}

output "rds_security_group_id" {
  description = "Security group ID for network configuration"
  value       = aws_security_group.rds.id
}