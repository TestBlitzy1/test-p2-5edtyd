# AWS EKS Configuration for Sales Intelligence Platform
# Provider: hashicorp/aws ~> 5.0
# Purpose: Defines the EKS cluster and node groups with enhanced security and monitoring

# KMS key for EKS secrets encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-key"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM role for EKS cluster
resource "aws_iam_role" "eks_cluster" {
  name = "${var.project_name}-${var.environment}-eks-cluster"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

# Attach required policies to EKS cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# Security group for EKS cluster
resource "aws_security_group" "eks_cluster" {
  name        = "${var.project_name}-${var.environment}-eks-cluster"
  description = "Security group for EKS cluster"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-cluster-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Main EKS cluster
resource "aws_eks_cluster" "main" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# IAM role for EKS node groups
resource "aws_iam_role" "eks_node_group" {
  name = "${var.project_name}-${var.environment}-eks-node-group"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

# Attach required policies to node group role
resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}

# General purpose node group
resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "general"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = ["m5.xlarge", "m5.2xlarge"]
  capacity_type  = "ON_DEMAND"

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 1
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role        = "general"
    environment = var.environment
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-node-general"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry
  ]
}

# CPU-optimized node group for AI workloads
resource "aws_eks_node_group" "cpu_optimized" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "cpu-optimized"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = ["c6i.2xlarge", "c6i.4xlarge"]
  capacity_type  = "ON_DEMAND"

  scaling_config {
    desired_size = 2
    max_size     = 8
    min_size     = 1
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role        = "cpu-optimized"
    workload    = "ai-processing"
    environment = var.environment
  }

  taint {
    key    = "workload"
    value  = "ai-processing"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-node-cpu-optimized"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry
  ]
}

# Outputs for reference by other resources
output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.eks_cluster.id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}