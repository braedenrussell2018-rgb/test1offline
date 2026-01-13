# Access Control Model

## SOC 2 Type I Compliance Documentation

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Classification:** Internal

---

## 1. Overview

This document describes the access control model implemented in the Serial Stock Suite application to meet SOC 2 Type I requirements for logical access controls.

## 2. Role-Based Access Control (RBAC)

### 2.1 User Roles

The application implements four distinct user roles with hierarchical permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | System administrators with full access | Full |
| **Employee** | Internal staff with operational access | High |
| **Salesman** | Sales representatives with limited access | Medium |
| **Customer** | External customers with minimal access | Low |

### 2.2 Role Assignment

- New users self-register as Customer, Salesman, or Employee
- Owner role can only be assigned by existing Owners
- Role changes are logged in the audit system
- Principle of least privilege is enforced

### 2.3 Permission Matrix

| Resource | Owner | Employee | Salesman | Customer |
|----------|-------|----------|----------|----------|
| Inventory Management | ✓ | ✓ | ✗ | ✗ |
| CRM / Contacts | ✓ | ✓ | ✗ | ✗ |
| Quotes | ✓ | ✓ | ✗ | ✗ |
| Invoices | ✓ | ✓ | ✗ | ✗ |
| Expenses | ✓ | ✓ | ✗ | ✗ |
| Accounting | ✓ | ✓ | ✗ | ✗ |
| Spiff Program | ✓ | ✓ | ✓ | ✗ |
| Spiff Administration | ✓ | ✗ | ✗ | ✗ |
| Security Administration | ✓ | ✗ | ✗ | ✗ |
| User Management | ✓ | ✗ | ✗ | ✗ |
| Audit Logs | ✓ | ✗ | ✗ | ✗ |
| Customer Dashboard | ✗ | ✗ | ✗ | ✓ |

## 3. Authentication Controls

### 3.1 Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)

### 3.2 Multi-Factor Authentication (MFA)

- TOTP-based MFA using authenticator apps
- Required for all user accounts per SOC 2 policy
- MFA enrollment tracked in security settings
- MFA status visible in user management

### 3.3 Session Management

- Session timeout: 30 minutes of inactivity
- Secure session tokens with automatic refresh
- Session activity tracking for audit purposes
- Logout audit event logging

## 4. Rate Limiting & Account Protection

### 4.1 Login Rate Limiting

- 5 failed attempts per 15-minute window
- Automatic temporary lockout after limit exceeded
- Lockout duration: 15 minutes

### 4.2 Account Locking

- Automatic lock after multiple lockout events
- Manual lock capability for administrators
- Unlock requires administrator action
- Lock/unlock events logged with reason

## 5. Database Security

### 5.1 Row Level Security (RLS)

All database tables implement Row Level Security policies:

- Users can only access data appropriate to their role
- Sensitive operations require authenticated users
- Service role bypass for system operations only

### 5.2 Data Encryption

- Data encrypted at rest using AES-256
- TLS 1.3 for data in transit
- Sensitive fields (passwords, tokens) use bcrypt/argon2

## 6. Audit Trail

### 6.1 Logged Events

- Authentication (login success/failure, logout)
- Role changes
- Data access and modifications
- Data exports
- Security events (account lock/unlock)
- Failed access attempts

### 6.2 Audit Log Fields

Each audit entry includes:
- Timestamp (ISO 8601)
- Actor ID and email
- Actor role
- Action performed
- Target type and ID
- Result (success/failure/blocked)
- Risk level
- IP address
- Session ID

## 7. Access Reviews

### 7.1 Recommended Schedule

| Review Type | Frequency | Responsible |
|-------------|-----------|-------------|
| User access review | Quarterly | Owner |
| Role assignment review | Quarterly | Owner |
| Audit log review | Monthly | Owner |
| Failed login review | Weekly | Owner |

## 8. Implementation References

- Frontend route protection: `src/components/RoleProtectedRoute.tsx`
- User role hook: `src/hooks/useUserRole.tsx`
- Security settings: `src/hooks/useSecuritySettings.ts`
- Audit logging: `src/hooks/useAuditLog.ts`
- Database policies: Supabase RLS policies
- Admin dashboard: `src/pages/SecurityAdmin.tsx`

---

**Note:** This document should be reviewed and updated whenever access control policies change.
