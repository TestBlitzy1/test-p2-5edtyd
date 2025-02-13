#!/usr/bin/env bash

# Deploy Monitoring Infrastructure Script
# Version: 1.0.0
# This script deploys and configures a comprehensive monitoring stack including
# Prometheus, Grafana, ELK Stack, and Jaeger with enhanced security and validation.

set -euo pipefail
IFS=$'\n\t'

# Global variables
readonly MONITORING_DIR="../docker/monitoring"
readonly GRAFANA_PORT="3000"
readonly PROMETHEUS_PORT="9090"
readonly ELASTICSEARCH_PORT="9200"
readonly KIBANA_PORT="5601"
readonly JAEGER_PORT="16686"
readonly BACKUP_DIR="/opt/monitoring/backups"
readonly LOG_DIR="/var/log/monitoring"
readonly RETENTION_DAYS="30"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_DIR}/deploy-monitoring.log"
}

# Error handling function
error_exit() {
    log "ERROR" "${RED}$1${NC}"
    exit 1
}

# Check prerequisites for deployment
check_prerequisites() {
    local environment=$1

    log "INFO" "Checking prerequisites for ${environment} environment..."

    # Check Docker version
    if ! docker --version | grep -q "20.10"; then
        error_exit "Docker version 20.10 or higher is required"
    fi

    # Check docker-compose version
    if ! docker-compose --version | grep -q "2.20"; then
        error_exit "docker-compose version 2.20 or higher is required"
    fi

    # Check kubectl if using Kubernetes
    if ! kubectl version --client | grep -q "1.27"; then
        error_exit "kubectl version 1.27 or higher is required"
    fi

    # Verify required directories
    for dir in "${BACKUP_DIR}" "${LOG_DIR}"; do
        if [[ ! -d "${dir}" ]]; then
            mkdir -p "${dir}" || error_exit "Failed to create directory: ${dir}"
        fi
    done

    # Check port availability
    for port in "${GRAFANA_PORT}" "${PROMETHEUS_PORT}" "${ELASTICSEARCH_PORT}" "${KIBANA_PORT}" "${JAEGER_PORT}"; do
        if netstat -tln | grep -q ":${port}"; then
            error_exit "Port ${port} is already in use"
        fi
    done

    # Verify configuration files
    local config_files=(
        "${MONITORING_DIR}/docker-compose.yml"
        "${MONITORING_DIR}/prometheus/prometheus.yml"
        "${MONITORING_DIR}/grafana/datasources.yml"
    )

    for file in "${config_files[@]}"; do
        if [[ ! -f "${file}" ]]; then
            error_exit "Configuration file not found: ${file}"
        fi
    done

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Create monitoring namespace in Kubernetes
create_monitoring_namespace() {
    local environment=$1

    log "INFO" "Creating monitoring namespace for ${environment}..."

    # Create namespace with labels
    kubectl create namespace monitoring --dry-run=client -o yaml | \
    kubectl apply -f - || error_exit "Failed to create monitoring namespace"

    # Apply resource quotas
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: monitoring
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 16Gi
    limits.cpu: "8"
    limits.memory: 32Gi
EOF

    log "INFO" "Monitoring namespace created successfully"
    return 0
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    local environment=$1
    local backup_flag=$2

    log "INFO" "Deploying monitoring stack for ${environment}..."

    # Create backup if flag is set
    if [[ "${backup_flag}" == "true" ]]; then
        local backup_date=$(date '+%Y%m%d_%H%M%S')
        local backup_path="${BACKUP_DIR}/monitoring_${backup_date}.tar.gz"
        
        tar -czf "${backup_path}" -C "${MONITORING_DIR}" . || \
            error_exit "Failed to create backup"
        
        log "INFO" "Backup created at ${backup_path}"
    fi

    # Pull latest images
    log "INFO" "Pulling latest monitoring images..."
    docker-compose -f "${MONITORING_DIR}/docker-compose.yml" pull || \
        error_exit "Failed to pull Docker images"

    # Deploy stack
    log "INFO" "Deploying monitoring services..."
    docker-compose -f "${MONITORING_DIR}/docker-compose.yml" up -d || \
        error_exit "Failed to deploy monitoring stack"

    # Wait for services to be ready
    local services=("prometheus" "grafana" "elasticsearch" "kibana" "jaeger")
    for service in "${services[@]}"; do
        local retries=0
        while ! docker-compose -f "${MONITORING_DIR}/docker-compose.yml" ps "${service}" | grep -q "Up"; do
            if ((retries >= 30)); then
                error_exit "Service ${service} failed to start"
            fi
            log "INFO" "Waiting for ${service} to be ready..."
            sleep 10
            ((retries++))
        done
    done

    log "INFO" "Monitoring stack deployed successfully"
    return 0
}

# Configure Grafana
configure_grafana() {
    local environment=$1

    log "INFO" "Configuring Grafana..."

    # Wait for Grafana to be ready
    until curl -s "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null; do
        log "INFO" "Waiting for Grafana to be ready..."
        sleep 5
    done

    # Configure datasources
    curl -X POST -H "Content-Type: application/json" \
         -d @"${MONITORING_DIR}/grafana/datasources.yml" \
         "http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:${GRAFANA_PORT}/api/datasources" || \
        error_exit "Failed to configure Grafana datasources"

    # Import dashboards
    for dashboard in "${MONITORING_DIR}/grafana/dashboards"/*.json; do
        if [[ -f "${dashboard}" ]]; then
            curl -X POST -H "Content-Type: application/json" \
                 -d @"${dashboard}" \
                 "http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:${GRAFANA_PORT}/api/dashboards/db" || \
                log "WARN" "Failed to import dashboard: ${dashboard}"
        fi
    done

    log "INFO" "Grafana configuration completed"
    return 0
}

# Verify monitoring setup
verify_monitoring() {
    local environment=$1

    log "INFO" "Verifying monitoring setup..."

    # Check Prometheus
    if ! curl -s "http://localhost:${PROMETHEUS_PORT}/-/healthy" > /dev/null; then
        error_exit "Prometheus health check failed"
    fi

    # Check Grafana
    if ! curl -s "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null; then
        error_exit "Grafana health check failed"
    fi

    # Check Elasticsearch
    if ! curl -s "http://localhost:${ELASTICSEARCH_PORT}/_cluster/health" | grep -q '"status":"green"'; then
        error_exit "Elasticsearch health check failed"
    fi

    # Check Kibana
    if ! curl -s "http://localhost:${KIBANA_PORT}/api/status" > /dev/null; then
        error_exit "Kibana health check failed"
    fi

    # Check Jaeger
    if ! curl -s "http://localhost:${JAEGER_PORT}" > /dev/null; then
        error_exit "Jaeger health check failed"
    fi

    log "INFO" "All monitoring services verified successfully"
    return 0
}

# Main function
main() {
    local environment=${1:-"production"}
    local backup_flag=${2:-"true"}

    log "INFO" "Starting monitoring deployment for ${environment} environment"

    # Execute deployment steps
    check_prerequisites "${environment}" || exit 1
    create_monitoring_namespace "${environment}" || exit 1
    deploy_monitoring_stack "${environment}" "${backup_flag}" || exit 1
    configure_grafana "${environment}" || exit 1
    verify_monitoring "${environment}" || exit 1

    log "INFO" "${GREEN}Monitoring deployment completed successfully${NC}"
    return 0
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi