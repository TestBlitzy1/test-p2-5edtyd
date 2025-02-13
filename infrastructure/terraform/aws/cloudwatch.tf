# CloudWatch Configuration for Sales Intelligence Platform
# Version: 1.0.0
# Provider: hashicorp/aws ~> 5.0

# Log Groups for EKS and Application Components
resource "aws_cloudwatch_log_group" "eks_logs" {
  name              = "/aws/eks/${var.project_name}-${var.environment}/cluster"
  retention_in_days = var.monitoring_configuration.logs_retention_days
  
  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-logs"
    Environment = var.environment
    Component   = "eks"
  }
}

# Application Microservices Log Groups
resource "aws_cloudwatch_log_group" "microservices_logs" {
  for_each = {
    campaign-service  = "/aws/applications/campaign-service"
    ai-engine        = "/aws/applications/ai-engine"
    analytics-service = "/aws/applications/analytics-service"
    auth-service     = "/aws/applications/auth-service"
  }

  name              = "${each.value}/${var.project_name}-${var.environment}"
  retention_in_days = var.monitoring_configuration.logs_retention_days

  tags = {
    Name        = "${var.project_name}-${var.environment}-${each.key}"
    Environment = var.environment
    Service     = each.key
  }
}

# Service Error Rate Alarms
resource "aws_cloudwatch_metric_alarm" "service_error_rate" {
  for_each = {
    campaign-service  = 5  # 5% error threshold
    ai-engine        = 3  # 3% error threshold
    analytics-service = 5  # 5% error threshold
    auth-service     = 1  # 1% error threshold (more critical)
  }

  alarm_name          = "${var.project_name}-${var.environment}-${each.key}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "ErrorRate"
  namespace          = "Applications/${var.project_name}"
  period             = 300
  statistic          = "Average"
  threshold          = each.value
  alarm_description  = "Error rate exceeded threshold for ${each.key}"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    Service     = each.key
    Environment = var.environment
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-${each.key}-error-alarm"
    Environment = var.environment
    Service     = each.key
  }
}

# API Gateway Latency Alarm
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.project_name}-${var.environment}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name        = "Latency"
  namespace          = "AWS/ApiGateway"
  period             = 300
  statistic          = "p95"
  threshold          = 1000 # 1 second latency threshold
  alarm_description  = "API Gateway P95 latency exceeded 1 second"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiName = "${var.project_name}-api"
    Stage   = var.environment
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-latency-alarm"
    Environment = var.environment
    Component   = "api-gateway"
  }
}

# EKS Cluster Resource Utilization Alarms
resource "aws_cloudwatch_metric_alarm" "eks_cpu_utilization" {
  alarm_name          = "${var.project_name}-${var.environment}-eks-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "node_cpu_utilization"
  namespace          = "ContainerInsights"
  period             = 300
  statistic          = "Average"
  threshold          = 80
  alarm_description  = "EKS cluster CPU utilization exceeded 80%"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = "${var.project_name}-${var.environment}"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks-cpu-alarm"
    Environment = var.environment
    Component   = "eks"
  }
}

# Main Operational Dashboard
resource "aws_cloudwatch_dashboard" "main_dashboard" {
  dashboard_name = "${var.project_name}-${var.environment}-main"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        x    = 0
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["ContainerInsights", "node_cpu_utilization", "ClusterName", "${var.project_name}-${var.environment}"],
            ["ContainerInsights", "node_memory_utilization", "ClusterName", "${var.project_name}-${var.environment}"]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "EKS Cluster Resource Utilization"
        }
      },
      {
        type = "metric"
        x    = 12
        y    = 0
        width = 12
        height = 6
        properties = {
          metrics = [
            ["Applications/${var.project_name}", "ErrorRate", "Service", "campaign-service"],
            ["Applications/${var.project_name}", "ErrorRate", "Service", "ai-engine"],
            ["Applications/${var.project_name}", "ErrorRate", "Service", "analytics-service"],
            ["Applications/${var.project_name}", "ErrorRate", "Service", "auth-service"]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Service Error Rates"
        }
      },
      {
        type = "log"
        x    = 0
        y    = 6
        width = 24
        height = 6
        properties = {
          query   = "SOURCE '/aws/applications/' | fields @timestamp, @message, @logStream, service, error_type | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Application Errors"
          view    = "table"
        }
      }
    ]
  })
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-alerts"
    Environment = var.environment
  }
}

# Outputs
output "log_group_names" {
  description = "Map of log group names for each application component"
  value = merge(
    { eks = aws_cloudwatch_log_group.eks_logs.name },
    { for k, v in aws_cloudwatch_log_group.microservices_logs : k => v.name }
  )
}

output "dashboard_arn" {
  description = "ARN of the main CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main_dashboard.dashboard_arn
}