/**
 * Script to simulate webhook failures for testing error handling
 * 
 * Prerequisites:
 *   npm install --save-dev axios
 * 
 * Usage:
 *   npm run test:webhook
 * 
 * This script demonstrates various failure scenarios:
 * 1. Missing signature
 * 2. Invalid signature
 * 3. Malformed event
 * 4. Missing required fields
 */

// Note: Install axios first: npm install --save-dev axios
// If axios is not available, use the curl examples in WEBHOOK_ERROR_HANDLING.md

let axios: any;
try {
  axios = require('axios');
} catch {
  console.error('axios not found. Install it with: npm install --save-dev axios');
  console.log('📖 Alternatively, use the curl examples in WEBHOOK_ERROR_HANDLING.md');
  process.exit(1);
}

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8000/webhook';

async function testWebhookFailure(scenario: string, payload: any, headers: Record<string, string> = {}) {
  console.log(`\n Testing: ${scenario}`);
  console.log('─'.repeat(50));
  
  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    });
    console.log('✅ Response:', response.status, response.data);
  } catch (error: any) {
    if (error.response) {
      console.log('Error Response:', error.response.status, error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

async function main() {
  console.log('🚀 Webhook Failure Testing Script');
  console.log('='.repeat(50));

  // Test 1: Missing signature
  await testWebhookFailure(
    'Missing Stripe Signature',
    { type: 'checkout.session.completed', data: { object: {} } },
    {}
  );

  // Test 2: Invalid signature
  await testWebhookFailure(
    'Invalid Stripe Signature',
    { type: 'checkout.session.completed', data: { object: {} } },
    { 'stripe-signature': 'invalid_signature_here' }
  );

  // Test 3: Malformed event (missing type)
  await testWebhookFailure(
    'Malformed Event - Missing Type',
    { data: { object: {} } },
    { 'stripe-signature': 'test_signature' }
  );

  // Test 4: Malformed event (missing data)
  await testWebhookFailure(
    'Malformed Event - Missing Data',
    { type: 'checkout.session.completed' },
    { 'stripe-signature': 'test_signature' }
  );

  // Test 5: Invalid session (missing id)
  await testWebhookFailure(
    'Invalid Session - Missing ID',
    {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test',
          amount_total: 5000
        }
      }
    },
    { 'stripe-signature': 'test_signature' }
  );

  // Test 6: Valid structure but missing webhook secret
  console.log('Note: To test missing webhook secret, unset STRIPE_WEBHOOK_SECRET env variable');
  
  console.log('Testing complete!');
}

main().catch(console.error);

