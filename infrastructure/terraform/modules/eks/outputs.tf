# Output definitions for the EKS cluster module
# These outputs expose critical information needed for cluster access and configuration
# Version: 1.0.0

output "cluster_id" {
  description = "The EKS cluster identifier used for resource tagging and cross-reference"
  value       = aws_eks_cluster.this.id
  sensitive   = false
}

output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server used for Kubernetes operations"
  value       = aws_eks_cluster.this.endpoint
  sensitive   = false
}

output "cluster_security_group_id" {
  description = "The security group ID attached to the EKS cluster for network access control"
  value       = aws_security_group.cluster.id
  sensitive   = false
}

output "node_group_role_arn" {
  description = "The ARN of the IAM role for EKS node groups used for AWS service permissions"
  value       = aws_iam_role.node_group.arn
  sensitive   = false
}

output "cluster_certificate_authority_data" {
  description = "The base64 encoded certificate data required for secure communication with the EKS cluster"
  value       = aws_eks_cluster.this.certificate_authority[0].data
  sensitive   = true
}

output "cluster_arn" {
  description = "The ARN of the EKS cluster for IAM and policy configurations"
  value       = aws_eks_cluster.this.arn
  sensitive   = false
}

output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.this.version
  sensitive   = false
}

output "cluster_platform_version" {
  description = "The platform version of the EKS cluster"
  value       = aws_eks_cluster.this.platform_version
  sensitive   = false
}

output "cluster_status" {
  description = "The current status of the EKS cluster"
  value       = aws_eks_cluster.this.status
  sensitive   = false
}

output "cluster_primary_security_group_id" {
  description = "The ID of the EKS cluster's primary security group"
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
  sensitive   = false
}

output "node_groups" {
  description = "Map of EKS node group objects with their configurations and status"
  value       = aws_eks_node_group.this
  sensitive   = false
}

output "cluster_vpc_config" {
  description = "VPC configuration for the EKS cluster including subnet and security group information"
  value = {
    subnet_ids              = aws_eks_cluster.this.vpc_config[0].subnet_ids
    security_group_ids      = aws_eks_cluster.this.vpc_config[0].security_group_ids
    public_access_cidrs     = aws_eks_cluster.this.vpc_config[0].public_access_cidrs
    endpoint_private_access = aws_eks_cluster.this.vpc_config[0].endpoint_private_access
    endpoint_public_access  = aws_eks_cluster.this.vpc_config[0].endpoint_public_access
    vpc_id                 = aws_eks_cluster.this.vpc_config[0].vpc_id
  }
  sensitive = false
}