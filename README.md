# Stripe Integration API

A TypeScript-based Express.js server with Stripe webhook integration, Prisma ORM, and automatic user management for product purchases.

## Features

- Stripe webhook signature verification
- Automatic checkout session tracking
- User creation and management
- Product purchase detection (Astrology Time Zone)
- Comprehensive error handling and recovery
- Prisma 7 with PostgreSQL adapter
- Database seeding support

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Configuration

The project uses Prisma 7 with PostgreSQL. Database configuration is managed through:

- **Schema**: `prisma/schema.prisma` - defines your database models
- **Config**: `prisma.config.ts` - contains the database connection URL

Set the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Database Migrations

```bash
npm run prisma:migrate
```

### 5. Seed Database (Optional)

Seed the database with initial products and test users:

```bash
npm run prisma:seed
```

This will create:

- 1 product: "Astrology Time Zone" ($50.00)
- 4 users: 1 user for each user type (Free, GreatAwakener, VirtualOracle, NonMember)

### 6. Environment Variables

Create a `.env` file with the following variables:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
PORT=8000
```

### 7. Build and Start

```bash
# Build TypeScript
npm run build

# Start the server
npm start

# Or run in development mode with watch
npm run dev
```

The server will run on port 8000 by default (or the port specified in the `PORT` environment variable).

## Database Schema

### User Model

- `id` - UUID primary key
- `firstName` - User's first name
- `lastName` - User's last name
- `email` - Unique email address
- `hasAstrology` - Boolean flag for astrology product access
- `userType` - Enum: `Free`, `GreatAwakener`, `VirtualOracle`, `NonMember`
- `createdAt` / `updatedAt` - Timestamps

### Product Model

- `id` - UUID primary key
- `name` - Product name
- `price` - Product price (Float)
- `stripeId` - Unique Stripe product ID
- `stripeActive` - Boolean flag for Stripe product status
- `createdAt` / `updatedAt` - Timestamps

### CheckoutSession Model

- `id` - UUID primary key
- `stripeSessionId` - Unique Stripe checkout session ID
- `customerId` - Stripe customer ID
- `customerEmail` - Customer email from checkout
- `amountTotal` - Total amount in cents
- `currency` - Currency code
- `paymentStatus` - Payment status from Stripe
- `createdAt` / `updatedAt` - Timestamps

## API Endpoints

### POST /webhook

Accepts Stripe webhooks and processes `checkout.session.completed` events.

**Features:**

- ✅ Webhook signature verification
- ✅ Event structure validation
- ✅ Automatic checkout session saving
- ✅ Product purchase detection
- ✅ User creation/update for "Astrology Time Zone" purchases
- ✅ Comprehensive error handling

**Behavior:**

1. Verifies webhook signature using Stripe's webhook secret
2. Validates event structure
3. Saves checkout session to database
4. If "Astrology Time Zone" product is purchased:
   - If user exists: Updates `hasAstrology = true`
   - If user doesn't exist: Creates new `NonMember` user with `hasAstrology = true`

**Response Codes:**

- `200 OK` - Successfully processed
- `400 Bad Request` - Invalid signature or malformed event (won't retry)
- `500 Internal Server Error` - Server error (Stripe will retry)

### GET /ping

Health check endpoint that returns `{ status: 'ok' }`.

## Webhook Configuration

1. **Set up Stripe Webhook:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/webhook`
   - Select event: `checkout.session.completed`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

2. **Local Development:**

   Use [ngrok](https://ngrok.com/) to expose your local server:

   ```bash
   ngrok http 8000
   ```

   Use the ngrok URL (e.g., `https://abc123.ngrok.io/webhook`) as your Stripe webhook endpoint.

## Error Handling

The webhook handler includes comprehensive error handling:

- **Signature Verification**: Rejects unauthorized requests
- **Duplicate Detection**: Handles duplicate webhooks gracefully
- **Graceful Degradation**: User operation failures don't fail the webhook
- **Structured Logging**: All errors logged with context
- **Retry Logic**: Returns appropriate HTTP status codes for Stripe retries

For detailed error handling documentation and recovery procedures, see [WEBHOOK_ERROR_HANDLING.md](./WEBHOOK_ERROR_HANDLING.md).

## Testing

### Test Webhook Failures

Test various error scenarios:

```bash
npm run test:webhook
```

This script simulates:

- Missing signatures
- Invalid signatures
- Malformed events
- Missing required fields

### Manual Testing

Use curl to test the webhook endpoint:

```bash
# Test invalid signature
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid" \
  -d '{"type":"checkout.session.completed","data":{"object":{}}}'
```

## Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with watch
- `npm start` - Start the production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Seed database with initial data
- `npm run test:webhook` - Test webhook error handling

### Project Structure

```text
stripe-integration-api/
├── src/
│   ├── index.ts           # Main Express server and webhook handler
│   └── lib/
│       └── prisma.ts      # Prisma client setup
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── config.ts          # Prisma 7 configuration
│   └── seed.ts            # Database seeding script
├── scripts/
│   └── test-webhook-failures.ts  # Webhook testing script
├── dist/                  # Compiled JavaScript (generated)
└── package.json
```

### Prisma 7 Notes

This project uses Prisma 7, which requires:

- Database connection URL in `prisma.config.ts` (not in `schema.prisma`)
- PostgreSQL adapter for PrismaClient initialization
- See `src/lib/prisma.ts` for adapter setup

## How It Works

### Webhook Processing Flow

1. **Receive Webhook** → Verify signature
2. **Validate Event** → Check event structure
3. **Save Session** → Store checkout session in database
4. **Check Products** → Fetch line items from Stripe
5. **Process User** → Update existing user or create new NonMember user
6. **Return Response** → Send appropriate HTTP status

### Product Purchase Logic

When a customer purchases "Astrology Time Zone" (`prod_TUrnEqRRgTx9Gz`):

- **Existing User**: Updates `hasAstrology = true`
- **New Customer**: Creates new user with:
  - Email from Stripe customer details
  - Name parsed from customer details
  - `userType = 'NonMember'`
  - `hasAstrology = true`

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**

   - Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
   - Ensure webhook endpoint URL is correct

2. **Database connection errors**

   - Check `DATABASE_URL` is correct
   - Verify database server is running
   - Check Prisma adapter configuration

3. **User not created/updated**

   - Check logs for error messages
   - Verify customer email exists in Stripe event
   - Ensure product ID matches `prod_TUrnEqRRgTx9Gz`

For more troubleshooting, see [WEBHOOK_ERROR_HANDLING.md](./WEBHOOK_ERROR_HANDLING.md).

## License

MIT
