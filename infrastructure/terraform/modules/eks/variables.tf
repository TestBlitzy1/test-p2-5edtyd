# AWS EKS Module Variables
# Version: 1.0.0
# Provider Requirements: AWS Provider ~> 5.0

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string

  validation {
    condition     = length(var.cluster_name) <= 100
    error_message = "Cluster name must be 100 characters or less"
  }
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.27"
}

variable "vpc_id" {
  description = "ID of the VPC where EKS cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs where EKS nodes will be deployed"
  type        = list(string)
}

variable "node_groups" {
  description = "Configuration for EKS node groups including instance types, scaling, labels and taints"
  type = map(object({
    instance_types = list(string)
    scaling_config = object({
      desired_size = number
      max_size     = number
      min_size     = number
    })
    labels = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))

  default = {
    general = {
      instance_types = ["t3.large"]
      scaling_config = {
        desired_size = 3
        max_size     = 10
        min_size     = 1
      }
      labels = {}
      taints = []
    }
  }
}

variable "enable_private_access" {
  description = "Enable private API server endpoint access for the EKS cluster"
  type        = bool
  default     = true
}

variable "enable_public_access" {
  description = "Enable public API server endpoint access for the EKS cluster"
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "List of CIDR blocks that can access the EKS cluster's public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "cluster_log_types" {
  description = "List of the desired control plane logging to enable"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "cluster_security_group_ids" {
  description = "List of security group IDs for the EKS cluster"
  type        = list(string)
  default     = []
}

variable "node_security_group_ids" {
  description = "List of security group IDs for the EKS worker nodes"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to be applied to all EKS resources"
  type        = map(string)
  default     = {}
}