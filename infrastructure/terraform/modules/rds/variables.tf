# Project and Environment Configuration
variable "project_name" {
  description = "Name of the project used for RDS resource naming and tagging"
  type        = string

  validation {
    condition     = length(var.project_name) <= 32
    error_message = "Project name must be 32 characters or less"
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Network Configuration
variable "vpc_id" {
  description = "ID of the VPC where RDS will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for RDS multi-AZ deployment"
  type        = list(string)
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs for RDS instance"
  type        = list(string)
}

# Instance Configuration
variable "instance_class" {
  description = "RDS instance class for PostgreSQL database"
  type        = string
  default     = "db.t3.large"
}

variable "engine_version" {
  description = "PostgreSQL engine version for RDS instance"
  type        = string
  default     = "15.4"
}

# Storage Configuration
variable "allocated_storage" {
  description = "Allocated storage size in GB for RDS instance"
  type        = number
  default     = 100

  validation {
    condition     = var.allocated_storage >= 20 && var.allocated_storage <= 65536
    error_message = "Allocated storage must be between 20 GB and 65536 GB"
  }
}

variable "max_allocated_storage" {
  description = "Maximum storage size in GB for RDS autoscaling"
  type        = number
  default     = 1000

  validation {
    condition     = var.max_allocated_storage >= var.allocated_storage
    error_message = "Maximum allocated storage must be greater than or equal to allocated storage"
  }
}

variable "storage_encrypted" {
  description = "Enable storage encryption for RDS instance"
  type        = bool
  default     = true
}

# Database Authentication
variable "db_username" {
  description = "Master username for PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Master password for PostgreSQL database"
  type        = string
  sensitive   = true
}

# High Availability and Backup Configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection for RDS instance"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60"
  }
}

# Tagging Configuration
variable "tags" {
  description = "Additional tags for RDS resources"
  type        = map(string)
  default     = {}
}