#!/bin/bash

# Health Check Script for Sales Intelligence Platform
# Version: 1.0.0
# Dependencies:
# - curl (latest)
# - jq (latest)

set -euo pipefail

# Global Constants
readonly HEALTH_CHECK_INTERVAL=30
readonly RESPONSE_TIME_THRESHOLD=100
readonly MAX_RETRIES=3
readonly LOG_FILE="/var/log/health-check.log"
readonly ALERT_THRESHOLD=2
readonly METRIC_EXPORT_PATH="/tmp/health_metrics"

# Initialize logging
setup_logging() {
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Health check script started"
}

# Check API Gateway health
check_api_gateway() {
    local api_gateway_url=$1
    local retry_count=$2
    local timeout_seconds=$3
    local attempt=1
    local status
    local response_time

    while [ $attempt -le "$retry_count" ]; do
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Checking API Gateway health (attempt $attempt)"
        
        start_time=$(date +%s%N)
        status=$(curl -s -w "%{http_code}" -o /dev/null \
            --max-time "$timeout_seconds" \
            "${api_gateway_url}/health")
        response_time=$(( ($(date +%s%N) - start_time) / 1000000 ))

        if [ "$status" -eq 200 ] && [ "$response_time" -lt "$RESPONSE_TIME_THRESHOLD" ]; then
            echo "{\"service\":\"api-gateway\",\"status\":\"healthy\",\"response_time\":$response_time}" | \
                tee -a "$METRIC_EXPORT_PATH/api_gateway.metrics"
            return 0
        fi

        echo "[$(date +'%Y-%m-%d %H:%M:%S')] API Gateway check failed. Status: $status, Response time: ${response_time}ms"
        sleep $((2 ** (attempt - 1)))
        ((attempt++))
    done

    return 1
}

# Check monitoring stack health
check_monitoring_stack() {
    local prometheus_url=$1
    local grafana_url=$2
    local elasticsearch_url=$3
    local kibana_url=$4
    local status=0

    # Check Prometheus
    if ! curl -sf "${prometheus_url}/-/healthy" > /dev/null; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Prometheus health check failed"
        status=1
    fi

    # Check Grafana
    if ! curl -sf "${grafana_url}/api/health" > /dev/null; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Grafana health check failed"
        status=1
    fi

    # Check Elasticsearch
    es_health=$(curl -sf "${elasticsearch_url}/_cluster/health" | jq -r '.status')
    if [ "$es_health" = "red" ]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Elasticsearch cluster is unhealthy (status: red)"
        status=1
    fi

    # Check Kibana
    if ! curl -sf "${kibana_url}/api/status" > /dev/null; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Kibana health check failed"
        status=1
    fi

    echo "{\"monitoring_stack\":\"$([ $status -eq 0 ] && echo 'healthy' || echo 'unhealthy')\"}" | \
        tee -a "$METRIC_EXPORT_PATH/monitoring.metrics"

    return $status
}

# Check Kubernetes services health
check_kubernetes_services() {
    local namespace=$1
    local context=$2
    local status=0

    # Check pod status
    unhealthy_pods=$(kubectl --context="$context" -n "$namespace" get pods \
        -o jsonpath='{range .items[?(@.status.phase!="Running")]}{.metadata.name}{"\n"}{end}')
    
    if [ -n "$unhealthy_pods" ]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Unhealthy pods found:"
        echo "$unhealthy_pods"
        status=1
    fi

    # Check service endpoints
    services=$(kubectl --context="$context" -n "$namespace" get services \
        -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
    
    for service in $services; do
        endpoints=$(kubectl --context="$context" -n "$namespace" get endpoints "$service" \
            -o jsonpath='{range .subsets[*]}{range .addresses[*]}{.ip}{"\n"}{end}{end}')
        
        if [ -z "$endpoints" ]; then
            echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: No endpoints found for service $service"
            status=1
        fi
    done

    echo "{\"kubernetes_services\":\"$([ $status -eq 0 ] && echo 'healthy' || echo 'unhealthy')\"}" | \
        tee -a "$METRIC_EXPORT_PATH/kubernetes.metrics"

    return $status
}

# Export metrics in Prometheus format
export_metrics() {
    local timestamp
    timestamp=$(date +%s)
    
    {
        echo "# HELP health_check_status Current health status of services"
        echo "# TYPE health_check_status gauge"
        
        while IFS= read -r metric_file; do
            service_name=$(basename "$metric_file" .metrics)
            status=$(jq -r 'if .status == "healthy" then 1 else 0 end' "$metric_file")
            echo "health_check_status{service=\"$service_name\"} $status $timestamp"
        done < <(find "$METRIC_EXPORT_PATH" -name "*.metrics")
    } > "$METRIC_EXPORT_PATH/metrics"
}

# Main function
main() {
    local exit_status=0
    
    # Create metrics directory
    mkdir -p "$METRIC_EXPORT_PATH"
    
    # Setup logging
    setup_logging

    # Check API Gateway
    if ! check_api_gateway "http://api-gateway-service" "$MAX_RETRIES" 5; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: API Gateway health check failed"
        exit_status=1
    fi

    # Check monitoring stack
    if ! check_monitoring_stack \
        "http://prometheus:9090" \
        "http://grafana:3000" \
        "http://elasticsearch:9200" \
        "http://kibana:5601"; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Monitoring stack health check failed"
        exit_status=1
    fi

    # Check Kubernetes services
    if ! check_kubernetes_services "default" "sales-intelligence"; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Kubernetes services health check failed"
        exit_status=1
    fi

    # Export metrics
    export_metrics

    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Health check completed with status: $exit_status"
    return $exit_status
}

# Execute main function
main "$@"