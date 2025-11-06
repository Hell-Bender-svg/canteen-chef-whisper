# Security & Production Features

## Overview
This document describes the security and production features implemented in the AKGEC Canteen system.

## Features Implemented

### 1. Audit Logging
- **Table**: `audit_logs`
- **Purpose**: Track all critical actions in the system
- **Fields**:
  - User ID, Action, Resource Type, Resource ID
  - IP Address, User Agent
  - Metadata (JSON), Timestamp
- **Access**: Admin-only via `/audit-logs` route
- **Logged Actions**:
  - Order placement
  - Wallet top-ups
  - Payment completions
  - Menu item CRUD operations
  - User role assignments

### 2. Rate Limiting
- **Table**: `rate_limit_tracker`
- **Implementation**: Database-backed rate limiter
- **Limits**:
  - Order placement: 10 requests / 5 minutes
  - Wallet top-up: 5 requests / 15 minutes
  - Recommendations: 20 requests / 1 minute
  - Auth login: 5 requests / 15 minutes
- **Location**: Shared utility in `supabase/functions/_shared/rateLimiter.ts`

### 3. Edge Function Security
All edge functions include:
- Rate limiting on sensitive operations
- Audit logging for critical actions
- IP and User-Agent tracking
- Request validation
- Error handling with sanitized error messages

### 4. Testing Infrastructure
- **Framework**: Vitest with React Testing Library
- **Setup**: `vitest.config.ts` and `src/test-setup.ts`
- **Mock**: Supabase client mocked for unit tests
- **Example Tests**: Component tests in `src/__tests__/`
- **Run Tests**: `npm run test`
- **Coverage**: `npm run test:coverage`

### 5. CI/CD Pipeline
- **File**: `.github/workflows/ci.yml`
- **Jobs**:
  - **test**: Linting, type-checking, unit tests, build
  - **security-scan**: npm audit for vulnerabilities
  - **edge-functions-check**: Deno type checking for edge functions
- **Triggers**: Push/PR to main and develop branches

## Database Functions

### `check_rate_limit(identifier, action, max_attempts, window_minutes)`
- Returns boolean indicating if request is allowed
- Automatically increments attempt counter
- Cleanup function: `cleanup_old_rate_limits()`

### `log_audit_event(user_id, action, resource_type, ...)`
- Creates audit log entry
- Returns log ID
- Security definer function

## Usage

### Audit Logger (Edge Functions)
```typescript
import { AuditLogger, AUDIT_ACTIONS } from '../_shared/auditLogger.ts';

const auditLogger = new AuditLogger(supabaseUrl, serviceKey);
const clientInfo = AuditLogger.extractClientInfo(req);

await auditLogger.log({
  userId: user.id,
  action: AUDIT_ACTIONS.ORDER_PLACED,
  resourceType: 'order',
  resourceId: order.id,
  ...clientInfo,
  metadata: { /* additional data */ }
});
```

### Rate Limiter (Edge Functions)
```typescript
import { RateLimiter, RATE_LIMITS } from '../_shared/rateLimiter.ts';

const rateLimiter = new RateLimiter(supabaseUrl, serviceKey);
const allowed = await rateLimiter.checkLimit(user.id, RATE_LIMITS.ORDER_PLACEMENT);

if (!allowed) {
  return new Response(
    JSON.stringify({ error: 'Too many requests' }),
    { status: 429 }
  );
}
```

## Admin Access
Admins can view audit logs at `/audit-logs` which shows:
- Timestamp
- Action performed
- Resource type and ID
- User ID
- IP Address

## Security Best Practices Implemented
1. ✅ Rate limiting on all critical endpoints
2. ✅ Comprehensive audit logging
3. ✅ RLS policies on all tables
4. ✅ Service role only for privileged operations
5. ✅ Client info tracking (IP, User-Agent)
6. ✅ Sanitized error messages
7. ✅ Input validation
8. ✅ Automated testing
9. ✅ CI/CD with security scans
10. ✅ No secrets in code (environment variables only)

## Future Enhancements
- [ ] Automated rate limit cleanup cron job
- [ ] More comprehensive test coverage
- [ ] Integration tests
- [ ] Performance testing
- [ ] Penetration testing
- [ ] SIEM integration for audit logs
