# Stripe Integration API

A TypeScript-based Express.js server with Stripe webhook integration and Prisma ORM.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up your database connection:
   - Update `prisma/schema.prisma` with your database provider if not using PostgreSQL
   - Set the `DATABASE_URL` environment variable (e.g., `postgresql://user:password@localhost:5432/mydb`)

3. Generate Prisma Client:

```bash
npm run prisma:generate
```

4. Run database migrations:

```bash
npm run prisma:migrate
```

5. Set environment variables:

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret
- `DATABASE_URL`: Your database connection string

6. Build TypeScript:

```bash
npm run build
```

7. Start the server:

```bash
npm start
```

The server will run on port 8000 by default (or the port specified in the `PORT` environment variable).

## Endpoints

### POST /webhook

Accepts Stripe webhooks and handles `checkout.session.completed` events.

The endpoint:

- Verifies the webhook signature using Stripe's webhook secret
- Processes `checkout.session.completed` events
- Saves checkout session data to the database using Prisma
- Returns appropriate responses for other event types

### GET /status

Health check endpoint that returns `{ status: 'ok' }`.

## Usage

1. Start the server:

```bash
npm start
```

2. Set up a Stripe webhook endpoint pointing to your server (e.g., `http://your-domain.com/webhook` or use a tool like [ngrok](https://ngrok.com/) for local development)
3. Configure the webhook to listen for `checkout.session.completed` events
4. Copy the webhook signing secret to your environment variables

## Development

### TypeScript

The project uses TypeScript. Source files are in the `src/` directory and compiled to `dist/`.

- Build: `npm run build`
- Watch mode: `npm run dev`

### Prisma

- Generate Prisma Client: `npm run prisma:generate`
- Create migration: `npm run prisma:migrate`
- Open Prisma Studio: `npm run prisma:studio`

### Database Schema

The Prisma schema includes a `CheckoutSession` model that stores:

- Stripe session ID
- Customer ID
- Amount and currency
- Payment status
- Timestamps

You can extend the schema in `prisma/schema.prisma` to add more models as needed.

## Local Development

For local webhook testing, you can use [ngrok](https://ngrok.com/) to expose your local server:

```bash
# In one terminal, start the server
npm start

# In another terminal, expose it with ngrok
ngrok http 8000
```

Then use the ngrok URL (e.g., `https://abc123.ngrok.io/webhook`) as your Stripe webhook endpoint.

Make sure to:

1. Set up a local database or use a cloud database
2. Run migrations before testing
3. Build the TypeScript code before starting the server
