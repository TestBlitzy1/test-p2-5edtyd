#!/bin/bash

# Database Backup Management Script
# Version: 1.0.0
# Required: aws-cli 2.0+
# Purpose: Manages automated and manual PostgreSQL database backups with AWS RDS snapshots
#          and S3 backup storage, featuring validation, encryption, and retention management

set -euo pipefail

# Global Configuration
DB_IDENTIFIER="${PROJECT_NAME:-default}-${ENVIRONMENT:-prod}-postgresql"
BACKUP_BUCKET="${PROJECT_NAME:-default}-${ENVIRONMENT:-prod}-db-backups"
RETENTION_DAYS=730
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/db-backup-${TIMESTAMP}.log"
BACKUP_WINDOW="0000-0600"
MAX_RETRIES=3

# Logging Configuration
log() {
    local level="$1"
    local message="$2"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
    
    # Send to CloudWatch if configured
    if [[ -n "${CLOUDWATCH_LOG_GROUP:-}" ]]; then
        aws logs put-log-events \
            --log-group-name "$CLOUDWATCH_LOG_GROUP" \
            --log-stream-name "db-backup" \
            --log-events timestamp=$(date +%s000),message="[$level] $message"
    fi
}

# Validation Functions
validate_prerequisites() {
    # Check AWS CLI version
    local aws_version
    aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d. -f1)
    if [[ "$aws_version" -lt 2 ]]; then
        log "ERROR" "AWS CLI version 2.0+ required"
        return 1
    fi

    # Validate AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log "ERROR" "Invalid AWS credentials"
        return 1
    fi

    # Check required environment variables
    local required_vars=("DB_IDENTIFIER" "BACKUP_BUCKET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required variable $var is not set"
            return 1
        fi
    done
}

# RDS Snapshot Creation
create_rds_snapshot() {
    local db_identifier="$1"
    local snapshot_name="${db_identifier}-${TIMESTAMP}"
    local timeout_minutes="${2:-60}"
    
    log "INFO" "Creating RDS snapshot: $snapshot_name"
    
    # Create snapshot
    local snapshot_arn
    snapshot_arn=$(aws rds create-db-snapshot \
        --db-instance-identifier "$db_identifier" \
        --db-snapshot-identifier "$snapshot_name" \
        --tags Key=Environment,Value="${ENVIRONMENT:-prod}" \
                Key=RetentionDays,Value="$RETENTION_DAYS" \
                Key=Purpose,Value="Automated backup" \
        --output text \
        --query 'DBSnapshot.DBSnapshotArn')
    
    # Monitor snapshot progress
    local attempts=0
    local max_attempts=$((timeout_minutes * 2))
    while [[ $attempts -lt $max_attempts ]]; do
        local status
        status=$(aws rds describe-db-snapshots \
            --db-snapshot-identifier "$snapshot_name" \
            --output text \
            --query 'DBSnapshots[0].Status')
            
        if [[ "$status" == "available" ]]; then
            log "INFO" "Snapshot creation completed: $snapshot_name"
            echo "$snapshot_arn"
            return 0
        elif [[ "$status" == "failed" ]]; then
            log "ERROR" "Snapshot creation failed: $snapshot_name"
            return 1
        fi
        
        ((attempts++))
        sleep 30
    done
    
    log "ERROR" "Snapshot creation timed out: $snapshot_name"
    return 1
}

# S3 Backup Export
backup_to_s3() {
    local db_host="$1"
    local db_name="$2"
    local backup_path="$3"
    local encryption_key="$4"
    
    log "INFO" "Starting S3 backup export for $db_name"
    
    # Create temporary directory
    local temp_dir
    temp_dir=$(mktemp -d)
    chmod 700 "$temp_dir"
    
    # Check available disk space
    local required_space
    required_space=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_IDENTIFIER" \
        --query 'DBInstances[0].AllocatedStorage' \
        --output text)
    
    local available_space
    available_space=$(df -k "$temp_dir" | awk 'NR==2 {print $4}')
    
    if [[ $available_space -lt $((required_space * 1024 * 1024)) ]]; then
        log "ERROR" "Insufficient disk space for backup"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Perform database dump
    local backup_file="$temp_dir/$db_name-$TIMESTAMP.sql.gz"
    if ! PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "$db_host" \
        -U "${DB_USER}" \
        -d "$db_name" \
        -Z 9 \
        -F c \
        -f "$backup_file"; then
        log "ERROR" "Database dump failed"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Calculate checksum
    local checksum
    checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    # Encrypt backup
    local encrypted_file="$backup_file.enc"
    if ! openssl enc -aes-256-cbc \
        -salt \
        -in "$backup_file" \
        -out "$encrypted_file" \
        -k "$encryption_key"; then
        log "ERROR" "Backup encryption failed"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Upload to S3
    if ! aws s3 cp \
        "$encrypted_file" \
        "s3://$BACKUP_BUCKET/$backup_path" \
        --expected-size "$(stat -f%z "$encrypted_file")" \
        --storage-class STANDARD_IA \
        --metadata "checksum=$checksum,timestamp=$TIMESTAMP" \
        --tags "retention=$RETENTION_DAYS,environment=${ENVIRONMENT:-prod}"; then
        log "ERROR" "S3 upload failed"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log "INFO" "S3 backup completed: $backup_path"
    echo "s3://$BACKUP_BUCKET/$backup_path"
}

# Cleanup Old Backups
cleanup_old_backups() {
    local retention_days="$1"
    local dry_run="${2:-false}"
    
    log "INFO" "Starting backup cleanup (retention: $retention_days days)"
    
    local cutoff_date
    cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d)
    
    # Cleanup RDS snapshots
    local old_snapshots
    old_snapshots=$(aws rds describe-db-snapshots \
        --db-instance-identifier "$DB_IDENTIFIER" \
        --query "DBSnapshots[?SnapshotCreateTime<='$cutoff_date'].[DBSnapshotIdentifier]" \
        --output text)
    
    for snapshot in $old_snapshots; do
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "Would delete snapshot: $snapshot"
        else
            if aws rds delete-db-snapshot \
                --db-snapshot-identifier "$snapshot" &>/dev/null; then
                log "INFO" "Deleted snapshot: $snapshot"
            else
                log "ERROR" "Failed to delete snapshot: $snapshot"
            fi
        fi
    done
    
    # Cleanup S3 backups
    local old_backups
    old_backups=$(aws s3api list-objects-v2 \
        --bucket "$BACKUP_BUCKET" \
        --query "Contents[?LastModified<='$cutoff_date'].[Key]" \
        --output text)
    
    for backup in $old_backups; do
        if [[ "$dry_run" == "true" ]]; then
            log "INFO" "Would delete S3 backup: $backup"
        else
            if aws s3 rm "s3://$BACKUP_BUCKET/$backup" &>/dev/null; then
                log "INFO" "Deleted S3 backup: $backup"
            else
                log "ERROR" "Failed to delete S3 backup: $backup"
            fi
        fi
    done
}

# Backup Validation
check_backup_status() {
    local backup_path="$1"
    local snapshot_arn="$2"
    
    log "INFO" "Validating backup integrity"
    
    # Check RDS snapshot
    local snapshot_status
    snapshot_status=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier "$snapshot_arn" \
        --query 'DBSnapshots[0].Status' \
        --output text)
    
    if [[ "$snapshot_status" != "available" ]]; then
        log "ERROR" "Invalid snapshot status: $snapshot_status"
        return 1
    fi
    
    # Verify S3 backup
    if ! aws s3api head-object \
        --bucket "$BACKUP_BUCKET" \
        --key "$backup_path" &>/dev/null; then
        log "ERROR" "S3 backup not found: $backup_path"
        return 1
    fi
    
    # Get backup metadata
    local backup_metadata
    backup_metadata=$(aws s3api head-object \
        --bucket "$BACKUP_BUCKET" \
        --key "$backup_path" \
        --query 'Metadata' \
        --output json)
    
    # Validate metadata
    if [[ -z "$backup_metadata" ]]; then
        log "ERROR" "Missing backup metadata"
        return 1
    fi
    
    log "INFO" "Backup validation completed successfully"
    echo "$backup_metadata"
}

# Main backup function
main() {
    log "INFO" "Starting database backup process"
    
    # Validate prerequisites
    if ! validate_prerequisites; then
        log "ERROR" "Prerequisites validation failed"
        exit 1
    fi
    
    # Create RDS snapshot
    local snapshot_arn
    if ! snapshot_arn=$(create_rds_snapshot "$DB_IDENTIFIER" 60); then
        log "ERROR" "RDS snapshot creation failed"
        exit 1
    fi
    
    # Export to S3
    local backup_path="backups/${ENVIRONMENT:-prod}/${TIMESTAMP}/backup.sql.gz.enc"
    if ! backup_to_s3 \
        "${DB_HOST}" \
        "${DB_NAME}" \
        "$backup_path" \
        "${ENCRYPTION_KEY}"; then
        log "ERROR" "S3 backup export failed"
        exit 1
    fi
    
    # Validate backup
    if ! check_backup_status "$backup_path" "$snapshot_arn"; then
        log "ERROR" "Backup validation failed"
        exit 1
    fi
    
    # Cleanup old backups
    if ! cleanup_old_backups "$RETENTION_DAYS" false; then
        log "WARN" "Backup cleanup failed"
    fi
    
    log "INFO" "Database backup process completed successfully"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi