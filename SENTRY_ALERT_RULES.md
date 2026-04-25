# Sentry Alert Rules Configuration

This document provides instructions for setting up alert rules in Sentry to monitor error rates and critical crashes for LearnVault.

## Prerequisites

1. Access to Sentry organization with alert creation permissions
2. Sentry projects configured for both frontend and backend

---

## Alert Rule 1: High Error Rate (Critical)

Triggers when error rate exceeds threshold, indicating potential production issues.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Error Rate** metric
3. Configure:
   - **Dataset**: Errors
   - **Project**: Select your project (frontend or backend)
   - **Condition**: `error_rate()` is greater than `5` (errors per minute)
   - **Time window**: `5 minutes`
4. Add filters (optional):
   - `level:error`
   - `environment:production`
5. Configure actions:
   - Add notification to Slack/PagerDuty/Email
   - Set severity to **Critical**
6. Name: `High Error Rate - [Project Name]`

### JSON Configuration (Sentry CLI)

```json
{
  "name": "High Error Rate - Backend",
  "dataset": "errors",
  "query": "level:error",
  "aggregate": "count()",
  "timeWindow": 5,
  "thresholdType": "greater",
  "triggerActions": [
    {
      "action": "notify",
      "service": "slack",
      "channel": "#alerts-production"
    }
  ],
  "conditions": [
    {
      "id": "sentry.rules.conditions.event_frequency",
      "value": 25,
      "comparison": "greater",
      "interval": "5m"
    }
  ],
  "filters": [
    {
      "id": "sentry.rules.filters.environment",
      "name": "Production",
      "environments": ["production", "staging"]
    }
  ]
}
```

---

## Alert Rule 2: Critical Application Crashes

Triggers on specific critical error types that require immediate attention.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Issue Created** trigger
3. Configure:
   - **Dataset**: Issues
   - **Condition**: `issue.priority` equals `critical`
   - OR `error.type` equals specific critical errors:
     - `DatabaseConnectionError`
     - `AuthenticationError`
     - `PaymentProcessingError`
4. Add filters:
   - `environment:production`
   - `level:error`
5. Configure actions:
   - Immediate PagerDuty alert
   - Create Jira ticket
   - Set severity to **Critical**
6. Name: `Critical Application Crash - [Project Name]`

### JSON Configuration

```json
{
  "name": "Critical Application Crash - Backend",
  "dataset": "issues",
  "conditions": [
    {
      "id": "sentry.rules.conditions.first_seen_event",
      "name": "An issue is first seen"
    },
    {
      "id": "sentry.rules.conditions.level",
      "level": 40,
      "match": "eq"
    }
  ],
  "filters": [
    {
      "id": "sentry.rules.filters.environment",
      "environments": ["production"]
    }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "specific_users",
      "targetIdentifier": ["oncall@learnvault.xyz"]
    },
    {
      "id": "sentry.integrations.pagerduty.actions.notify.PagerDutyNotifyService",
      "account": "learnvault-pagerduty",
      "severity": "critical"
    }
  ]
}
```

---

## Alert Rule 3: Error Spike Detection

Detects sudden increases in error volume compared to baseline.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Error Count** metric
3. Configure:
   - **Dataset**: Errors
   - **Condition**: `count()` is greater than `200%` of baseline
   - **Baseline**: Previous 1 hour
   - **Time window**: `10 minutes`
4. Add filters:
   - `environment:production`
5. Configure actions:
   - Slack notification to #alerts
   - Set severity to **Warning**
6. Name: `Error Spike Detection - [Project Name]`

---

## Alert Rule 4: Frontend JavaScript Errors

Specific alerts for frontend JavaScript errors affecting users.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Error Rate** metric
3. Configure:
   - **Dataset**: Errors
   - **Project**: Frontend
   - **Condition**: `error_rate()` is greater than `10` per minute
   - **Time window**: `5 minutes`
4. Add filters:
   - `environment:production`
   - `error.type:*Error` (excludes warnings)
5. Configure actions:
   - Slack notification
   - Create GitHub issue
6. Name: `Frontend JavaScript Errors`

---

## Alert Rule 5: API Error Rate by Endpoint

Monitor error rates for specific API endpoints.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Error Rate** metric
3. Configure:
   - **Dataset**: Errors
   - **Project**: Backend
   - **Condition**: `error_rate()` is greater than `3` per minute
   - **Time window**: `5 minutes`
4. Add filters:
   - `transaction:/api/*`
   - `environment:production`
5. Group by: `transaction`
6. Configure actions:
   - Slack notification with endpoint details
7. Name: `API Endpoint Error Rate`

---

## Alert Rule 6: Wallet/Transaction Errors

Specific alerts for wallet connection and transaction failures.

### Via Sentry UI

1. Navigate to **Alerts** → **Create Alert**
2. Select **Issue Created** trigger
3. Configure:
   - **Query**: `message:*wallet* OR message:*transaction* OR message:*stellar*`
   - **Condition**: Issue priority is high or critical
4. Add filters:
   - `environment:production`
5. Configure actions:
   - Immediate notification to blockchain team
   - Set severity to **High**
6. Name: `Wallet/Transaction Errors`

---

## Notification Channels Setup

### Slack Integration

1. Go to **Settings** → **Integrations** → **Slack**
2. Click **Add Integration**
3. Authorize Sentry in your Slack workspace
4. Select channels for different severity levels:
   - `#alerts-critical`: Critical and High severity
   - `#alerts-warning`: Medium and Low severity
   - `#alerts-frontend`: Frontend-specific alerts
   - `#alerts-backend`: Backend-specific alerts

### PagerDuty Integration

1. Go to **Settings** → **Integrations** → **PagerDuty**
2. Click **Add Integration**
3. Enter PagerDuty service key
4. Map Sentry severity to PagerDuty urgency:
   - Critical → High urgency
   - High → High urgency
   - Medium → Low urgency

### Email Notifications

1. Go to **Settings** → **Alert Rules** → **Actions**
2. Add email action with recipients:
   - `oncall@learnvault.xyz` for critical alerts
   - `dev-team@learnvault.xyz` for warning alerts

---

## Recommended Alert Thresholds

| Alert Type | Threshold | Time Window | Severity |
|------------|-----------|-------------|----------|
| High Error Rate (Backend) | >5 errors/min | 5 min | Critical |
| High Error Rate (Frontend) | >10 errors/min | 5 min | High |
| Critical Crash | Any | Immediate | Critical |
| Error Spike | >200% of baseline | 10 min | Warning |
| API Endpoint Errors | >3 errors/min | 5 min | High |
| Wallet Errors | Any (production) | Immediate | High |

---

## Best Practices

1. **Avoid Alert Fatigue**: Start with higher thresholds and adjust based on baseline
2. **Use Environments**: Separate alerts for production vs. staging/development
3. **Escalation Policies**: Define clear escalation paths for different severity levels
4. **Runbooks**: Link to runbooks in alert notifications for quick resolution
5. **Regular Review**: Review and adjust thresholds monthly based on traffic patterns
6. **Test Alerts**: Periodically test alert delivery to ensure channels are working

---

## Sentry CLI Setup (Optional)

For managing alerts as code:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Authenticate
sentry login

# Export existing alert rules
sentry alerts export --project learnvault-backend

# Import alert rules from JSON
sentry alerts import ./alert-rules.json --project learnvault-backend
```

---

## Monitoring Dashboard

Create a dashboard to visualize alert metrics:

1. Navigate to **Dashboards** → **Create Dashboard**
2. Add widgets:
   - Error rate over time (both projects)
   - Error breakdown by type
   - Top 10 errors by volume
   - Alert firing history
3. Set auto-refresh to 1 minute for production dashboards
