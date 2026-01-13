# Encryption Strategy

## SOC 2 Type I Compliance Documentation

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Classification:** Internal

---

## 1. Overview

This document describes the encryption strategies implemented to protect data confidentiality and integrity in compliance with SOC 2 requirements.

## 2. Encryption at Rest

### 2.1 Database Encryption

| Component | Encryption Method | Key Management |
|-----------|------------------|----------------|
| PostgreSQL Database | AES-256-GCM | Supabase managed keys |
| File Storage | AES-256 | Supabase managed keys |
| Backups | AES-256 | Encrypted at rest |

### 2.2 Application-Level Encryption

- Sensitive configuration stored as encrypted secrets
- API keys stored in secure environment variables
- OAuth tokens encrypted before storage

### 2.3 Key Hierarchy

```
┌─────────────────────────────────────┐
│       Master Encryption Key         │
│     (Hardware Security Module)      │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Database │ │ Storage │ │ Backup  │
│   KEK   │ │   KEK   │ │   KEK   │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  Table  │ │  File   │ │ Archive │
│   DEKs  │ │   DEKs  │ │   DEKs  │
└─────────┘ └─────────┘ └─────────┘

KEK = Key Encryption Key
DEK = Data Encryption Key
```

## 3. Encryption in Transit

### 3.1 TLS Configuration

| Protocol | Minimum Version | Cipher Suites |
|----------|----------------|---------------|
| HTTPS | TLS 1.2 | TLS_AES_256_GCM_SHA384 |
| WebSocket | TLS 1.2 | TLS_CHACHA20_POLY1305_SHA256 |
| Database | TLS 1.2 | TLS_AES_128_GCM_SHA256 |

### 3.2 Certificate Management

- SSL certificates automatically provisioned
- Automatic certificate renewal
- HSTS headers enforced
- Certificate transparency logging

### 3.3 API Security

```
Client Request
     │
     │ HTTPS (TLS 1.3)
     ▼
┌─────────────────┐
│   Load Balancer │
│   (TLS Term)    │
└────────┬────────┘
         │ Internal TLS
         ▼
┌─────────────────┐
│   API Gateway   │
│   (Auth Check)  │
└────────┬────────┘
         │ Internal TLS
         ▼
┌─────────────────┐
│    Database     │
│   (Encrypted)   │
└─────────────────┘
```

## 4. Password Security

### 4.1 Hashing Algorithm

- Algorithm: bcrypt (Supabase Auth default)
- Work factor: 10 rounds
- Automatic salt generation

### 4.2 Password Requirements

| Requirement | Minimum |
|-------------|---------|
| Length | 8 characters |
| Uppercase | 1 character |
| Lowercase | 1 character |
| Numbers | 1 digit |
| Special chars | 1 character |

## 5. Token Security

### 5.1 JWT Tokens

| Token Type | Expiration | Signing Algorithm |
|------------|------------|-------------------|
| Access Token | 1 hour | HS256 |
| Refresh Token | 7 days | HS256 |
| MFA Challenge | 5 minutes | HS256 |

### 5.2 Token Storage

- Access tokens: Memory only (not persisted)
- Refresh tokens: HttpOnly secure cookies
- Session tokens: Encrypted local storage

## 6. Secret Management

### 6.1 Environment Variables

All sensitive configuration is stored in environment variables:

| Secret Type | Storage Location | Access Control |
|-------------|-----------------|----------------|
| Database URL | Supabase secrets | Platform only |
| API Keys | Edge function secrets | Admin only |
| OAuth Secrets | Supabase secrets | Platform only |

### 6.2 Secret Rotation

| Secret Type | Rotation Frequency | Process |
|-------------|-------------------|---------|
| API Keys | Annually or on compromise | Manual rotation |
| Database passwords | Quarterly | Automated |
| JWT signing keys | Annually | Platform managed |

## 7. Data Field Encryption

### 7.1 Sensitive Fields

| Table | Field | Encryption |
|-------|-------|------------|
| quickbooks_connections | access_token | Application-level |
| quickbooks_connections | refresh_token | Application-level |
| user_ai_settings | openai_api_key | Application-level |

### 7.2 PII Protection

Personal Identifiable Information (PII) is protected:

- Encrypted at rest in database
- Masked in logs and error messages
- Access logged for audit purposes

## 8. Cryptographic Standards

### 8.1 Approved Algorithms

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| Symmetric encryption | AES-256-GCM | 256-bit |
| Asymmetric encryption | RSA | 2048-bit min |
| Hashing | SHA-256, SHA-384 | - |
| Password hashing | bcrypt | 10 rounds |
| Key derivation | PBKDF2, Argon2 | - |

### 8.2 Deprecated Algorithms

The following are NOT used:

- MD5 (any purpose)
- SHA-1 (cryptographic)
- DES, 3DES
- RC4
- SSL 2.0/3.0, TLS 1.0/1.1

## 9. Compliance Verification

### 9.1 Regular Audits

| Check | Frequency | Method |
|-------|-----------|--------|
| TLS configuration | Monthly | Automated scan |
| Certificate validity | Weekly | Automated monitoring |
| Encryption coverage | Quarterly | Manual review |
| Key rotation | Per schedule | Automated reminders |

### 9.2 Monitoring

- Certificate expiration alerts
- TLS handshake failure monitoring
- Encryption error logging

---

**Note:** This document should be updated whenever encryption policies or implementations change.
