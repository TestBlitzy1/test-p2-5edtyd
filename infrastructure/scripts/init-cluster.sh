#!/usr/bin/env bash

# Sales Intelligence Platform - EKS Cluster Initialization Script
# Version: 1.0.0
# Required tool versions:
# - aws-cli: 2.0+
# - kubectl: 1.27+
# - helm: 3.0+

set -euo pipefail

# Source environment variables
if [[ -f ".env" ]]; then
    source .env
fi

# Default values
AWS_REGION=${AWS_REGION:-"us-east-1"}
CLUSTER_NAME=${CLUSTER_NAME:-"sales-intelligence-platform-dev"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to validate terraform state
validate_terraform_state() {
    log_info "Validating Terraform state..."
    
    if [[ ! -f "../terraform/aws/terraform.tfstate" ]]; then
        log_error "Terraform state file not found. Please run terraform apply first."
        return 1
    }

    # Verify required outputs are present
    local required_outputs=("cluster_name" "cluster_endpoint" "vpc_id" "private_subnet_ids")
    for output in "${required_outputs[@]}"; do
        if ! terraform output -state="../terraform/aws/terraform.tfstate" "$output" >/dev/null 2>&1; then
            log_error "Required Terraform output '$output' not found"
            return 1
        fi
    done
    
    log_info "Terraform state validation successful"
    return 0
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("aws" "kubectl" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "'$tool' not found. Please install it first."
            return 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        return 1
    }

    log_info "Prerequisites check passed"
    return 0
}

# Function to configure kubectl
configure_kubectl() {
    log_info "Configuring kubectl for EKS cluster..."
    
    aws eks update-kubeconfig \
        --region "$AWS_REGION" \
        --name "$CLUSTER_NAME" \
        --alias "$CLUSTER_NAME"

    # Verify cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Failed to connect to EKS cluster"
        return 1
    }

    log_info "kubectl configured successfully"
    return 0
}

# Function to install core components
install_core_components() {
    log_info "Installing core cluster components..."

    # Add required Helm repositories
    helm repo add eks https://aws.github.io/eks-charts
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add elastic https://helm.elastic.co
    helm repo update

    # Install AWS Load Balancer Controller
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
        --namespace kube-system \
        --set clusterName="$CLUSTER_NAME" \
        --set serviceAccount.create=true \
        --set region="$AWS_REGION" \
        --wait

    # Install metrics-server
    helm upgrade --install metrics-server stable/metrics-server \
        --namespace kube-system \
        --set args={"--kubelet-preferred-address-types=InternalIP"} \
        --wait

    # Install cluster-autoscaler
    helm upgrade --install cluster-autoscaler eks/cluster-autoscaler \
        --namespace kube-system \
        --set autoDiscovery.clusterName="$CLUSTER_NAME" \
        --set awsRegion="$AWS_REGION" \
        --wait

    # Install Prometheus stack
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.enabled=true \
        --set alertmanager.enabled=true \
        --wait

    log_info "Core components installed successfully"
    return 0
}

# Function to configure networking
configure_networking() {
    log_info "Configuring cluster networking..."

    # Apply CNI configuration
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

    # Configure CoreDNS
    kubectl -n kube-system patch configmap coredns --type merge \
        -p '{"data":{"Corefile":".:53 {\n    errors\n    health\n    kubernetes cluster.local in-addr.arpa ip6.arpa {\n        pods insecure\n        fallthrough in-addr.arpa ip6.arpa\n    }\n    prometheus :9153\n    forward . /etc/resolv.conf\n    cache 30\n    loop\n    reload\n    loadbalance\n}\n"}}'

    log_info "Network configuration completed"
    return 0
}

# Function to setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring and logging..."

    # Create monitoring namespace if it doesn't exist
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

    # Install Elasticsearch operator
    helm upgrade --install elasticsearch-operator elastic/eck-operator \
        --namespace monitoring \
        --wait

    # Configure Prometheus retention
    kubectl -n monitoring patch prometheus prometheus-kube-prometheus-prometheus --type merge \
        -p '{"spec":{"retention":"30d"}}'

    log_info "Monitoring setup completed"
    return 0
}

# Function to verify cluster health
verify_cluster_health() {
    log_info "Verifying cluster health..."

    # Check node status
    if ! kubectl get nodes | grep -q "Ready"; then
        log_error "No nodes are in Ready state"
        return 1
    }

    # Check core components
    local core_namespaces=("kube-system" "monitoring")
    for ns in "${core_namespaces[@]}"; do
        if ! kubectl get pods -n "$ns" | grep -q "Running"; then
            log_error "Pods in namespace $ns are not running"
            return 1
        fi
    done

    log_info "Cluster health verification passed"
    return 0
}

# Main execution
main() {
    log_info "Starting EKS cluster initialization for $CLUSTER_NAME in $AWS_REGION"

    # Run initialization steps
    validate_terraform_state || exit 1
    check_prerequisites || exit 1
    configure_kubectl || exit 1
    install_core_components || exit 1
    configure_networking || exit 1
    setup_monitoring || exit 1
    verify_cluster_health || exit 1

    log_info "Cluster initialization completed successfully"
}

# Execute main function
main