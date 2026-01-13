# Logging & Monitoring Strategy

## SOC 2 Type I Compliance Documentation

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Classification:** Internal

---

## 1. Overview

This document describes the logging and monitoring strategy implemented to meet SOC 2 requirements for security event detection and audit trail maintenance.

## 2. Audit Log Structure

### 2.1 Log Entry Schema

Every audit log entry contains the following fields:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | UUID | Unique log identifier | Yes |
| timestamp | ISO 8601 | When the event occurred | Yes |
| action | String | Type of action performed | Yes |
| action_category | Enum | Category classification | Yes |
| actor_id | UUID | User who performed action | No* |
| actor_email | String | Email of actor | No* |
| actor_role | String | Role at time of action | No |
| target_type | String | Type of resource affected | No |
| target_id | UUID | ID of affected resource | No |
| target_name | String | Name of affected resource | No |
| result | Enum | success/failure/blocked | Yes |
| failure_reason | String | Why action failed | No |
| risk_level | Enum | low/medium/high/critical | No |
| ip_address | INET | Client IP address | No |
| user_agent | String | Browser/client info | No |
| session_id | UUID | Session identifier | No |
| metadata | JSON | Additional context | No |

*System actions may not have an actor

### 2.2 Action Categories

| Category | Description | Examples |
|----------|-------------|----------|
| auth | Authentication events | Login, logout, MFA |
| data_access | Data viewing | View records, search |
| data_modification | Data changes | Create, update, delete |
| admin | Administrative actions | Role changes, settings |
| export | Data exports | CSV, JSON downloads |
| security | Security events | Account lock, access denied |

### 2.3 Risk Levels

| Level | Description | Examples |
|-------|-------------|----------|
| low | Normal operations | Successful login, data view |
| medium | Notable events | Failed login, data export |
| high | Security concerns | Role changes, multiple failures |
| critical | Urgent attention | Account lock, security breach |

## 3. Events Logged

### 3.1 Authentication Events

| Event | Logged Data | Risk Level |
|-------|-------------|------------|
| Login success | User, IP, time | Low |
| Login failed | Email, IP, reason | Medium |
| Logout | User, session duration | Low |
| Session expired | User, last activity | Low |
| MFA enabled | User | High |
| MFA disabled | User | Critical |
| Password changed | User | Medium |

### 3.2 Access Control Events

| Event | Logged Data | Risk Level |
|-------|-------------|------------|
| Role changed | User, old role, new role | High |
| Access denied | User, resource, reason | High |
| Account locked | User, reason | Critical |
| Account unlocked | User, admin who unlocked | High |

### 3.3 Data Events

| Event | Logged Data | Risk Level |
|-------|-------------|------------|
| Record created | Type, ID, creator | Low |
| Record updated | Type, ID, fields changed | Low |
| Record deleted | Type, ID, deleter | Medium |
| Data exported | Type, format, count | Medium |

## 4. Log Storage & Retention

### 4.1 Storage Configuration

```
┌─────────────────────────────────────────┐
│          audit_logs table               │
│                                         │
│  • Primary storage: PostgreSQL          │
│  • Indexed on: timestamp, action,       │
│    actor_id, risk_level                 │
│  • Partitioned by: month                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Archival Process              │
│                                         │
│  • After 90 days: Move to cold storage  │
│  • After 7 years: Secure deletion       │
└─────────────────────────────────────────┘
```

### 4.2 Retention Periods

| Log Type | Hot Storage | Archive | Total Retention |
|----------|-------------|---------|-----------------|
| Audit logs | 90 days | 7 years | 7 years |
| Login attempts | 90 days | 1 year | 1 year |
| Session logs | 30 days | 90 days | 120 days |
| Export logs | 90 days | 7 years | 7 years |

## 5. Monitoring & Alerting

### 5.1 Real-time Monitoring

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Failed logins | >10/min | Immediate |
| Account locks | Any | Immediate |
| Critical risk events | Any | Immediate |
| High risk events | >5/hour | 15 min delay |

### 5.2 Dashboard Metrics

The Security Admin dashboard displays:

- Total users
- MFA compliance rate
- Locked accounts count
- Recent high-risk events
- Login attempt trends
- Export activity

## 6. SIEM Integration

### 6.1 Export Formats

Logs can be exported in two formats for SIEM systems:

**CSV Format:**
- Human-readable
- Compatible with spreadsheet tools
- Suitable for ad-hoc analysis

**JSON Format:**
- Machine-parseable
- Full metadata included
- Recommended for SIEM import

### 6.2 Export Fields (SIEM)

```json
{
  "exported_at": "2025-01-13T12:00:00Z",
  "total_records": 1000,
  "filters": {
    "search": "",
    "category": "all",
    "risk": "all",
    "result": "all"
  },
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2025-01-13T11:55:00Z",
      "action": "login_success",
      "action_category": "auth",
      "actor_id": "user-uuid",
      "actor_email": "user@example.com",
      "actor_role": "employee",
      "result": "success",
      "risk_level": "low",
      "ip_address": "192.168.1.1",
      "session_id": "session-uuid"
    }
  ]
}
```

### 6.3 Integration Steps

1. Navigate to Security Admin > Audit Logs
2. Apply desired filters
3. Click "JSON (SIEM)" export button
4. Import file into SIEM system
5. Configure regular export schedule

## 7. Log Integrity

### 7.1 Tamper Protection

- Logs written with service role (bypasses RLS)
- No UPDATE or DELETE permissions for users
- Append-only design
- Timestamp from server, not client

### 7.2 Verification

- Log hashes for integrity verification
- Cross-reference with session logs
- Anomaly detection for log gaps

## 8. Access to Logs

### 8.1 Permissions

| Role | Permission |
|------|------------|
| Owner | Full read, export |
| Employee | None |
| Salesman | None |
| Customer | None |

### 8.2 Log Access Logging

Access to audit logs is itself logged:

- Who accessed logs
- When they accessed
- What filters used
- Any exports performed

## 9. Compliance Reporting

### 9.1 Standard Reports

| Report | Frequency | Contents |
|--------|-----------|----------|
| Security summary | Weekly | High-risk events, login trends |
| Access review | Monthly | User activity summary |
| Compliance report | Quarterly | Full audit trail |
| Annual review | Yearly | Comprehensive analysis |

### 9.2 On-Demand Reports

The Security Admin dashboard supports filtering by:

- Date range
- Action category
- Risk level
- Result (success/failure/blocked)
- Search term (action, email, target)

---

**Note:** This document should be updated whenever logging policies or implementations change.
