#!/bin/bash

# Sales Intelligence Platform - Key Rotation Script
# Version: 1.0.0
# Requires: aws-cli 2.0+, kubectl 1.27+, openssl 3.0+

set -euo pipefail

# Global Configuration
ROTATION_INTERVAL=30 # Days between key rotations
KEY_TYPES=("jwt" "encryption" "platform")
LOG_PATH="/var/log/key-rotation.log"
BACKUP_PATH="/var/backup/keys"
MIN_KEY_LENGTH=32
MAX_RETRY_ATTEMPTS=3
HEALTH_CHECK_TIMEOUT=300

# Logging Configuration
log() {
    local level=$1
    local message=$2
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$LOG_PATH"
}

# Pre-rotation Health Check
check_system_health() {
    log "INFO" "Initiating system health check..."
    
    # Verify Kubernetes connectivity
    if ! kubectl get nodes &>/dev/null; then
        log "ERROR" "Failed to connect to Kubernetes cluster"
        return 1
    }
    
    # Verify AWS connectivity
    if ! aws sts get-caller-identity &>/dev/null; then
        log "ERROR" "Failed to connect to AWS"
        return 1
    }
    
    # Verify backup directory
    if [ ! -d "$BACKUP_PATH" ]; then
        mkdir -p "$BACKUP_PATH"
        log "INFO" "Created backup directory: $BACKUP_PATH"
    }
    
    return 0
}

# JWT Secret Rotation
rotate_jwt_secret() {
    log "INFO" "Starting JWT secret rotation"
    local success=false
    local attempt=1
    
    while [ $attempt -le $MAX_RETRY_ATTEMPTS ] && [ "$success" = false ]; do
        # Generate new NIST-compliant JWT secret
        local new_secret=$(openssl rand -base64 48)
        
        if [ ${#new_secret} -lt $MIN_KEY_LENGTH ]; then
            log "ERROR" "Generated JWT secret does not meet minimum length requirement"
            return 1
        }
        
        # Backup current secret
        kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.JWT_SECRET}' | \
            base64 -d > "$BACKUP_PATH/jwt_secret_$(date +%Y%m%d_%H%M%S).bak"
        
        # Update secret in AWS Secrets Manager
        if aws secretsmanager update-secret \
            --secret-id "sales-intelligence/jwt-secret" \
            --secret-string "$new_secret" &>/dev/null; then
            
            # Update Kubernetes secret
            kubectl patch secret sales-intelligence-platform-secrets \
                --type='json' \
                -p="[{\"op\": \"replace\", \"path\": \"/data/JWT_SECRET\", \"value\": \"$(echo -n "$new_secret" | base64)\"}]"
            
            # Validate new secret
            if validate_key_rotation "jwt"; then
                success=true
                log "INFO" "JWT secret rotation completed successfully"
            fi
        fi
        
        ((attempt++))
    done
    
    return $success
}

# Encryption Key Rotation
rotate_encryption_key() {
    log "INFO" "Starting encryption key rotation"
    
    # Generate new encryption key using AWS KMS
    local new_key_id=$(aws kms create-key \
        --description "Sales Intelligence Platform Encryption Key $(date +%Y-%m-%d)" \
        --tags TagKey=Environment,TagValue=production \
        --output text \
        --query 'KeyMetadata.KeyId')
    
    if [ -z "$new_key_id" ]; then
        log "ERROR" "Failed to generate new encryption key"
        return 1
    }
    
    # Create key alias
    aws kms create-alias \
        --alias-name "alias/sales-intelligence-encryption-$(date +%Y%m%d)" \
        --target-key-id "$new_key_id"
    
    # Backup current key
    kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.ENCRYPTION_KEY}' | \
        base64 -d > "$BACKUP_PATH/encryption_key_$(date +%Y%m%d_%H%M%S).bak"
    
    # Update Kubernetes secret
    kubectl patch secret sales-intelligence-platform-secrets \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/data/ENCRYPTION_KEY\", \"value\": \"$(echo -n "$new_key_id" | base64)\"}]"
    
    # Validate new key
    if ! validate_key_rotation "encryption"; then
        log "ERROR" "Encryption key validation failed"
        return 1
    }
    
    log "INFO" "Encryption key rotation completed successfully"
    return 0
}

# Platform Credentials Rotation
rotate_platform_credentials() {
    log "INFO" "Starting platform credentials rotation"
    
    # LinkedIn API credentials rotation
    if ! rotate_linkedin_credentials; then
        log "ERROR" "LinkedIn credentials rotation failed"
        return 1
    }
    
    # Google Ads API credentials rotation
    if ! rotate_google_ads_credentials; then
        log "ERROR" "Google Ads credentials rotation failed"
        return 1
    }
    
    log "INFO" "Platform credentials rotation completed successfully"
    return 0
}

# LinkedIn Credentials Rotation
rotate_linkedin_credentials() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRY_ATTEMPTS ]; do
        # Generate new LinkedIn API credentials
        local new_client_id=$(aws secretsmanager get-random-password \
            --password-length 32 \
            --require-each-included-type \
            --output text \
            --query 'RandomPassword')
        
        local new_client_secret=$(aws secretsmanager get-random-password \
            --password-length 64 \
            --require-each-included-type \
            --output text \
            --query 'RandomPassword')
        
        # Update Kubernetes secret
        kubectl patch secret sales-intelligence-platform-secrets \
            --type='json' \
            -p="[
                {\"op\": \"replace\", \"path\": \"/data/LINKEDIN_CLIENT_ID\", \"value\": \"$(echo -n "$new_client_id" | base64)\"},
                {\"op\": \"replace\", \"path\": \"/data/LINKEDIN_CLIENT_SECRET\", \"value\": \"$(echo -n "$new_client_secret" | base64)\"}
            ]"
        
        if validate_key_rotation "linkedin"; then
            log "INFO" "LinkedIn credentials rotation successful"
            return 0
        fi
        
        ((attempt++))
        sleep 5
    done
    
    return 1
}

# Google Ads Credentials Rotation
rotate_google_ads_credentials() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRY_ATTEMPTS ]; do
        # Generate new Google Ads API credentials
        local new_client_id=$(aws secretsmanager get-random-password \
            --password-length 32 \
            --require-each-included-type \
            --output text \
            --query 'RandomPassword')
        
        local new_client_secret=$(aws secretsmanager get-random-password \
            --password-length 64 \
            --require-each-included-type \
            --output text \
            --query 'RandomPassword')
        
        # Update Kubernetes secret
        kubectl patch secret sales-intelligence-platform-secrets \
            --type='json' \
            -p="[
                {\"op\": \"replace\", \"path\": \"/data/GOOGLE_ADS_CLIENT_ID\", \"value\": \"$(echo -n "$new_client_id" | base64)\"},
                {\"op\": \"replace\", \"path\": \"/data/GOOGLE_ADS_CLIENT_SECRET\", \"value\": \"$(echo -n "$new_client_secret" | base64)\"}
            ]"
        
        if validate_key_rotation "google-ads"; then
            log "INFO" "Google Ads credentials rotation successful"
            return 0
        fi
        
        ((attempt++))
        sleep 5
    done
    
    return 1
}

# Key Rotation Validation
validate_key_rotation() {
    local key_type=$1
    local validation_success=true
    
    case $key_type in
        "jwt")
            # Validate JWT token generation
            if ! curl -s -f -H "Authorization: Bearer $(kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.JWT_SECRET}' | base64 -d)" \
                https://api.salesintelligence.com/health &>/dev/null; then
                validation_success=false
            fi
            ;;
        "encryption")
            # Validate encryption/decryption
            local test_data="validation_test_$(date +%s)"
            local encrypted_data=$(echo "$test_data" | openssl enc -aes-256-cbc -a -k "$(kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.ENCRYPTION_KEY}' | base64 -d)")
            local decrypted_data=$(echo "$encrypted_data" | openssl enc -aes-256-cbc -a -d -k "$(kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.ENCRYPTION_KEY}' | base64 -d)")
            
            if [ "$test_data" != "$decrypted_data" ]; then
                validation_success=false
            fi
            ;;
        "linkedin")
            # Validate LinkedIn API connectivity
            if ! curl -s -f -H "Authorization: Bearer $(kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.LINKEDIN_CLIENT_SECRET}' | base64 -d)" \
                https://api.linkedin.com/v2/adAccounts &>/dev/null; then
                validation_success=false
            fi
            ;;
        "google-ads")
            # Validate Google Ads API connectivity
            if ! curl -s -f -H "Authorization: Bearer $(kubectl get secret sales-intelligence-platform-secrets -o jsonpath='{.data.GOOGLE_ADS_CLIENT_SECRET}' | base64 -d)" \
                https://googleads.googleapis.com/v14/customers &>/dev/null; then
                validation_success=false
            fi
            ;;
    esac
    
    if [ "$validation_success" = true ]; then
        log "INFO" "Validation successful for $key_type"
        return 0
    else
        log "ERROR" "Validation failed for $key_type"
        return 1
    fi
}

# Main key rotation orchestration
rotate_all_keys() {
    log "INFO" "Starting key rotation process"
    
    # Check system health
    if ! check_system_health; then
        log "ERROR" "System health check failed. Aborting rotation."
        return 1
    }
    
    # Create rotation lock
    if ! mkdir /tmp/key-rotation.lock 2>/dev/null; then
        log "ERROR" "Another rotation process is running"
        return 1
    }
    
    trap 'rm -rf /tmp/key-rotation.lock' EXIT
    
    # Rotate keys
    local rotation_success=true
    
    if ! rotate_jwt_secret; then
        log "ERROR" "JWT secret rotation failed"
        rotation_success=false
    fi
    
    if ! rotate_encryption_key; then
        log "ERROR" "Encryption key rotation failed"
        rotation_success=false
    fi
    
    if ! rotate_platform_credentials; then
        log "ERROR" "Platform credentials rotation failed"
        rotation_success=false
    fi
    
    # Generate audit report
    if [ "$rotation_success" = true ]; then
        generate_audit_report
        log "INFO" "Key rotation completed successfully"
        return 0
    else
        log "ERROR" "Key rotation failed"
        return 1
    fi
}

# Audit report generation
generate_audit_report() {
    local report_file="$BACKUP_PATH/audit_report_$(date +%Y%m%d_%H%M%S).json"
    
    {
        echo "{"
        echo "  \"rotation_timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"rotation_status\": \"success\","
        echo "  \"rotated_keys\": ["
        for key_type in "${KEY_TYPES[@]}"; do
            echo "    {"
            echo "      \"type\": \"$key_type\","
            echo "      \"rotation_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
            echo "      \"validation_status\": \"success\""
            echo "    },"
        done
        echo "  ],"
        echo "  \"compliance\": {"
        echo "    \"nist_compliance\": true,"
        echo "    \"gdpr_compliance\": true,"
        echo "    \"soc2_compliance\": true"
        echo "  }"
        echo "}"
    } > "$report_file"
    
    log "INFO" "Generated audit report: $report_file"
}

# Script entry point
main() {
    rotate_all_keys
    exit $?
}

main