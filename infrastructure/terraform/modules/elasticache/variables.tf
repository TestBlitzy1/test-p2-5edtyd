# Redis Cluster Identification
variable "cluster_name" {
  type        = string
  description = "Name of the Redis cluster for the Sales Intelligence Platform"
}

# Instance Configuration
variable "node_type" {
  type        = string
  description = "AWS instance type for Redis nodes (e.g. cache.t3.medium, cache.r5.large)"
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the Redis cluster"
  default     = 2
}

# Networking Configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the Redis cluster will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where Redis nodes will be deployed for high availability"
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access the Redis cluster"
}

# Redis Engine Configuration
variable "engine_version" {
  type        = string
  description = "Redis engine version"
  default     = "7.0"
}

# High Availability Configuration
variable "automatic_failover_enabled" {
  type        = bool
  description = "Enable automatic failover for Redis cluster"
  default     = true
}

variable "multi_az_enabled" {
  type        = bool
  description = "Enable Multi-AZ deployment for Redis cluster"
  default     = true
}

# Security Configuration
variable "at_rest_encryption_enabled" {
  type        = bool
  description = "Enable encryption at rest for Redis cluster data"
  default     = true
}

variable "transit_encryption_enabled" {
  type        = bool
  description = "Enable encryption in transit (TLS) for Redis cluster connections"
  default     = true
}

# Maintenance Configuration
variable "maintenance_window" {
  type        = string
  description = "Weekly time window for maintenance operations (UTC)"
  default     = "sun:05:00-sun:09:00"
}

variable "snapshot_window" {
  type        = string
  description = "Daily time window when Redis will create a snapshot (UTC)"
  default     = "00:00-03:00"
}

variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain Redis cluster snapshots"
  default     = 7
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all Redis cluster resources"
  default     = {}
}