# Data Flow Diagram

## SOC 2 Type I Compliance Documentation

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Classification:** Internal

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    React Application                          │    │
│  │  • Authentication UI    • Security Admin Dashboard           │    │
│  │  • Business Features    • Audit Log Viewer                   │    │
│  │  • MFA Setup            • User Management                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                    HTTPS/TLS 1.3                                     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Supabase Edge                              │    │
│  │  • Rate limiting        • JWT validation                     │    │
│  │  • Request routing      • CORS enforcement                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Auth Service   │  │  Edge Functions  │  │ Storage Service │     │
│  │                  │  │                  │  │                 │     │
│  │ • User auth      │  │ • audit-log      │  │ • File uploads  │     │
│  │ • MFA/TOTP       │  │ • security-check │  │ • Encryption    │     │
│  │ • Session mgmt   │  │ • ai-assistant   │  │ • Access control│     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL Database                        │    │
│  │                                                               │    │
│  │  SECURITY TABLES              BUSINESS TABLES                 │    │
│  │  • user_roles                 • items (inventory)             │    │
│  │  • user_security_settings     • people (contacts)             │    │
│  │  • audit_logs                 • companies                     │    │
│  │  • login_attempts             • invoices                      │    │
│  │  • data_export_logs           • quotes                        │    │
│  │                               • expenses                      │    │
│  │  Row Level Security (RLS) enforced on all tables              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Client  │     │  Auth    │     │ Database │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Login       │                │                │
     │ credentials    │                │                │
     ├───────────────►│                │                │
     │                │ 2. Check       │                │
     │                │ rate limit     │                │
     │                ├───────────────►│                │
     │                │                │ 3. Query       │
     │                │                │ attempts       │
     │                │                ├───────────────►│
     │                │                │◄───────────────┤
     │                │◄───────────────┤                │
     │                │                │                │
     │                │ 4. If allowed, │                │
     │                │ authenticate   │                │
     │                ├───────────────►│                │
     │                │                │ 5. Validate    │
     │                │                │ credentials    │
     │                │                ├───────────────►│
     │                │                │◄───────────────┤
     │                │                │                │
     │                │ 6. MFA         │                │
     │◄───────────────┤ challenge      │                │
     │                │ (if enabled)   │                │
     │ 7. TOTP code   │                │                │
     ├───────────────►│                │                │
     │                │ 8. Verify MFA  │                │
     │                ├───────────────►│                │
     │                │◄───────────────┤                │
     │                │                │                │
     │                │ 9. Log audit   │                │
     │                │ event          │                │
     │                ├────────────────┼───────────────►│
     │                │                │                │
     │ 10. Session    │                │                │
     │ token          │                │                │
     │◄───────────────┤                │                │
```

## 3. Data Access Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Client  │     │ Supabase │     │ Database │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Request     │                │                │
     │ data           │                │                │
     ├───────────────►│                │                │
     │                │ 2. API call    │                │
     │                │ with JWT       │                │
     │                ├───────────────►│                │
     │                │                │ 3. Validate    │
     │                │                │ JWT            │
     │                │                │                │
     │                │                │ 4. Apply RLS   │
     │                │                │ policies       │
     │                │                ├───────────────►│
     │                │                │                │
     │                │                │ 5. Return      │
     │                │                │ filtered data  │
     │                │                │◄───────────────┤
     │                │◄───────────────┤                │
     │ 6. Render      │                │                │
     │ data           │                │                │
     │◄───────────────┤                │                │
```

## 4. Audit Logging Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Client  │     │   Edge   │     │ Database │
│ Action   │     │   App    │     │ Function │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Perform     │                │                │
     │ action         │                │                │
     ├───────────────►│                │                │
     │                │ 2. Execute     │                │
     │                │ action         │                │
     │                ├────────────────┼───────────────►│
     │                │                │                │
     │                │ 3. Call        │                │
     │                │ audit-log      │                │
     │                ├───────────────►│                │
     │                │                │ 4. Insert      │
     │                │                │ audit record   │
     │                │                ├───────────────►│
     │                │                │◄───────────────┤
     │                │◄───────────────┤                │
     │◄───────────────┤                │                │
```

## 5. Data Classification

| Classification | Description | Examples | Protection |
|---------------|-------------|----------|------------|
| **Public** | Non-sensitive business data | Product descriptions | Standard access controls |
| **Internal** | Business operational data | Inventory, quotes | Role-based access |
| **Confidential** | Sensitive business data | Financials, customer PII | Encrypted, logged access |
| **Restricted** | Security-critical data | Credentials, audit logs | Encrypted, admin only |

## 6. External Integrations

| Integration | Data Exchanged | Security Controls |
|-------------|----------------|-------------------|
| QuickBooks | Financial data | OAuth 2.0, encrypted tokens |
| OpenAI | Conversation data | API key in secrets, no PII |
| Mapbox | Location data | API key in secrets |

## 7. Data Retention

| Data Type | Retention Period | Disposal Method |
|-----------|-----------------|-----------------|
| Audit logs | 7 years | Secure deletion |
| Login attempts | 90 days | Automatic purge |
| Session data | Session + 24 hours | Automatic purge |
| Business data | Per customer contract | Secure deletion |

---

**Note:** This diagram should be updated whenever system architecture changes.
