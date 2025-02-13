# Pull Request Description

## Title
<!-- Provide a concise description of the changes -->

## Description
<!-- Provide a detailed description of the changes and their purpose -->

## Related Issues
<!-- Link to related issues or tickets (e.g., SIP-123) -->

---

# Type of Change
<!-- Check all that apply -->
- [ ] Feature Implementation
- [ ] Bug Fix
- [ ] Performance Improvement
- [ ] Code Refactoring
- [ ] Documentation Update
- [ ] CI/CD Changes
- [ ] Security Enhancement
- [ ] AI/ML Model Update

---

# Testing
## Test Coverage
<!-- Specify the test coverage percentage (minimum 80% required) -->
Coverage: __%

## Test Types Completed
- [ ] Unit Tests
- [ ] Integration Tests
- [ ] E2E Tests
- [ ] Performance Tests
- [ ] Security Tests
- [ ] AI/ML Model Tests

---

# Compliance & Security
## Security Checklist
<!-- All items must be checked -->
- [ ] Security scan passed (Snyk/SonarQube)
- [ ] No sensitive data exposed
- [ ] Authentication/Authorization validated
- [ ] Input validation implemented
- [ ] Error handling implemented
- [ ] GDPR compliance verified
- [ ] API security standards met
- [ ] Data encryption verified
- [ ] SOC 2 requirements met

---

# Platform Impact
## Affected Components
<!-- Select all that apply -->
- [ ] Campaign Generation Engine
- [ ] Analytics & Reporting
- [ ] Platform Integration
- [ ] AI/ML Processing
- [ ] User Interface
- [ ] Data Storage
- [ ] Authentication System
- [ ] API Gateway

## Platform Integration Impact
<!-- Select all that apply -->
- [ ] LinkedIn Ads Integration
- [ ] Google Ads Integration
- [ ] Database Schema
- [ ] API Endpoints
- [ ] Frontend Components
- [ ] AI Models
- [ ] Authentication Flow
- [ ] Performance Metrics

## Performance Impact Analysis
<!-- Describe any performance implications of the changes -->

---

# Review Checklist
## Code Quality
<!-- All items must be checked -->
- [ ] Code follows style guide (ESLint/Prettier)
- [ ] Documentation updated
- [ ] No console logs/debugging code
- [ ] Error handling implemented
- [ ] Performance considerations addressed
- [ ] API versioning maintained
- [ ] Logging implemented correctly
- [ ] Monitoring hooks added

---

# Additional Notes
<!-- Any additional information that reviewers should be aware of -->

---

<!-- 
This PR template is automatically processed by the following automation hooks:
- On Create: assign_reviewers, run_ci_pipeline, check_test_coverage, run_security_scan, verify_compliance, check_dependencies
- On Update: notify_reviewers, update_status, rerun_checks, validate_changes
- On Merge: update_changelog, trigger_deployment, notify_team, update_documentation, run_integration_tests
-->