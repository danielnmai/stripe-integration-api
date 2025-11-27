import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 8000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Missing stripe-signature header or webhook secret' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = req.body.toString();
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    const error = err as Error;
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    console.log('Checkout session completed:', {
      sessionId: session.id,
      customerId: session.customer,
      amountTotal: session.amount_total,
      currency: session.currency,
      paymentStatus: session.payment_status
    });

    try {
      // Save checkout session to database using Prisma
      await prisma.checkoutSession.create({
        data: {
          stripeSessionId: session.id,
          customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          amountTotal: session.amount_total || 0,
          currency: session.currency || 'usd',
          paymentStatus: session.payment_status || 'unknown',
        },
      });

      console.log('Checkout session saved to database:', session.id);
    } catch (dbError) {
      const error = dbError as Error;
      console.error('Failed to save checkout session to database:', error.message);
      // Continue execution even if database save fails
    }
    
    return res.status(200).json({ 
      received: true,
      sessionId: session.id 
    });
  }

  return res.status(200).json({ received: true });
});

app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

