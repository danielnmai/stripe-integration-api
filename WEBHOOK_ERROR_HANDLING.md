# Webhook Error Handling & Recovery Guide

## Overview

This document describes the error handling mechanisms in place for Stripe webhook processing and how to recover from various failure scenarios.

## Error Handling Architecture

### 1. Webhook Signature Verification

**Location**: `src/index.ts` - Webhook endpoint

**What it does**:
- Verifies the `stripe-signature` header against the webhook secret
- Ensures the request is actually from Stripe
- Prevents replay attacks and unauthorized requests

**Failure Response**: Returns `400 Bad Request` with error details

### 2. Event Structure Validation

**What it validates**:
- Event has a `type` field
- Event has a `data` field
- Session has required fields (e.g., `id`)

**Failure Response**: Returns `400 Bad Request`

### 3. Database Operations

**Error Handling Strategy**:
- **Checkout Session Creation**: 
  - If duplicate (already exists), logs warning and continues
  - If other error, throws to outer catch block
- **User Operations**: 
  - Wrapped in try-catch to prevent webhook failure
  - Errors are logged but don't fail the webhook response
  - This ensures checkout session is always saved even if user update fails

**Failure Response**: 
- User operation failures: Logged, webhook returns `200 OK`
- Critical failures: Returns `500 Internal Server Error` (Stripe will retry)

## Failure Scenarios & Recovery

### Scenario 1: Invalid Webhook Signature

**Symptoms**:
- Log: `Webhook signature verification failed`
- Response: `400 Bad Request`

**Causes**:
- Wrong webhook secret in environment variables
- Request not from Stripe
- Signature header missing or malformed

**Recovery Steps**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe Dashboard
2. Check that the webhook endpoint URL is correct in Stripe
3. Ensure the request is coming from Stripe (check IP if needed)
4. Re-send the webhook from Stripe Dashboard if needed

### Scenario 2: Duplicate Webhook (Already Processed)

**Symptoms**:
- Log: `Checkout session {id} already exists in database - may be a duplicate webhook`
- Response: `200 OK` (continues processing)

**Causes**:
- Stripe retrying a webhook
- Network issues causing duplicate delivery
- Manual webhook replay

**Recovery Steps**:

1. **No action needed** - The system handles duplicates gracefully
2. Processing continues for user updates (idempotent operations)
3. Check logs to verify if user was updated correctly

### Scenario 3: Database Connection Failure

**Symptoms**:

- Log: `Critical error processing webhook`
- Response: `500 Internal Server Error`

**Causes**:

- Database server down
- Connection pool exhausted
- Network issues

**Recovery Steps**:

1. Check database connection status
2. Verify `DATABASE_URL` is correct
3. Check database server logs
4. Stripe will automatically retry (up to 3 times over 3 days)
5. After fixing, manually replay failed webhooks from Stripe Dashboard

### Scenario 4: Stripe API Failure (Line Items)

**Symptoms**:

- Log: `Failed to fetch line items for session {id}`
- Response: `200 OK` (checkout session still saved)

**Causes**:

- Stripe API temporarily unavailable
- Rate limiting
- Invalid session ID

**Recovery Steps**:

1. Check Stripe API status
2. Verify session ID is valid
3. Manually process the session:

   ```typescript
   // Use Prisma Studio or script to:
   // 1. Find the checkout session
   // 2. Get customer email
   // 3. Manually update user's hasAstrology field
   ```

### Scenario 5: User Creation/Update Failure

**Symptoms**:

- Log: `Failed to update/create user for {email}`
- Response: `200 OK` (checkout session saved)

**Causes**:

- Email validation failure
- Database constraint violation
- Missing required fields

**Recovery Steps**:

1. Check the error message in logs
2. Verify user data structure
3. Manually create/update user:

   ```typescript
   await prisma.user.upsert({
     where: { email: 'customer@example.com' },
     update: { hasAstrology: true },
     create: {
       email: 'customer@example.com',
       firstName: 'Customer',
       lastName: 'Name',
       userType: 'NonMember',
       hasAstrology: true
     }
   });
   ```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Webhook Success Rate**: Should be > 99%
2. **Signature Verification Failures**: Should be 0 (indicates security issue)
3. **Database Errors**: Should be < 1%
4. **Stripe API Errors**: Should be < 0.1%

### Logging

All errors are logged with:
- Error message
- Session ID (if available)
- Stack trace (for debugging)
- Event type

### Recommended Alerts

1. **High Error Rate**: Alert if > 5% of webhooks fail in 5 minutes
2. **Signature Failures**: Alert immediately (security concern)
3. **Database Errors**: Alert if > 10 failures in 1 hour
4. **Stripe API Errors**: Alert if > 5 failures in 1 hour

## Testing Error Handling

### Using the Test Script

```bash
# Install axios if not already installed
npm install --save-dev axios @types/axios

# Run the test script
npm run test:webhook
```

The test script (`scripts/test-webhook-failures.ts`) simulates:
- Missing signatures
- Invalid signatures
- Malformed events
- Missing required fields

### Manual Testing

1. **Test Invalid Signature**:
   ```bash
   curl -X POST http://localhost:8000/webhook \
     -H "Content-Type: application/json" \
     -H "stripe-signature: invalid" \
     -d '{"type":"checkout.session.completed","data":{"object":{}}}'
   ```

2. **Test Missing Signature**:
   ```bash
   curl -X POST http://localhost:8000/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"checkout.session.completed","data":{"object":{}}}'
   ```

3. **Test Malformed Event**:
   ```bash
   curl -X POST http://localhost:8000/webhook \
     -H "Content-Type: application/json" \
     -H "stripe-signature: test" \
     -d '{"invalid":"event"}'
   ```

## Recovery Procedures

### For Failed Webhooks in Stripe Dashboard

1. **Identify Failed Webhooks**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click on your webhook endpoint
   - View "Failed" events

2. **Replay Failed Webhooks**:
   - Click on a failed event
   - Click "Replay" button
   - Monitor logs to ensure successful processing

3. **Manual Recovery** (if replay fails):
   - Extract session ID from failed event
   - Use Prisma Studio or script to:
     - Verify checkout session exists
     - Check if user needs to be created/updated
     - Manually process if needed

### Database Recovery Script

Create a recovery script for processing missed webhooks:

```typescript
// scripts/recover-webhook.ts
import { prisma } from '../src/lib/prisma';

async function recoverSession(sessionId: string) {
  const session = await prisma.checkoutSession.findUnique({
    where: { stripeSessionId: sessionId }
  });
  
  if (!session) {
    console.error('Session not found');
    return;
  }
  
  if (session.customerEmail) {
    // Process user update logic here
    // (same as in webhook handler)
  }
}
```

## Best Practices

1. **Idempotency**: All operations are idempotent (safe to retry)
2. **Graceful Degradation**: User operations don't fail the webhook
3. **Comprehensive Logging**: All errors logged with context
4. **Proper HTTP Status Codes**: 
   - `200` = Success (even if some operations failed)
   - `400` = Client error (won't retry)
   - `500` = Server error (Stripe will retry)

5. **Monitoring**: Set up alerts for error patterns
6. **Documentation**: Keep this guide updated with new scenarios

## Stripe Retry Behavior

Stripe automatically retries failed webhooks:
- **First retry**: After 5 minutes
- **Second retry**: After 1 hour
- **Third retry**: After 6 hours
- **Fourth retry**: After 12 hours
- **Final retry**: After 24 hours

After 3 days, Stripe stops retrying. You'll need to manually replay from the Dashboard.

## Support

For issues:
1. Check logs for detailed error messages
2. Review this guide for recovery steps
3. Check Stripe Dashboard for webhook delivery status
4. Verify environment variables are set correctly

