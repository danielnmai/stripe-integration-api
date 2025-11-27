import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 8000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  
  if (!sig || !webhookSecret) {
    console.error('Missing stripe-signature header or webhook secret');
    return res.status(400).json({ 
      error: 'Missing stripe-signature header or webhook secret',
      received: false 
    });
  }

  let event: Stripe.Event;

  try {
    const rawBody = req.body;
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    const error = err as Error;
    console.error('Webhook signature verification failed:', {
      error: error.message,
      signature: sig,
      hasSecret: !!webhookSecret
    });
    return res.status(400).json({ 
      error: `Webhook signature verification failed: ${error.message}`,
      received: false 
    });
  }

  if (!event || !event.type || !event.data) {
    console.error('Invalid event structure:', event);
    return res.status(400).json({ 
      error: 'Invalid event structure',
      received: false 
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    console.log('Checkout session completed:', {
      sessionId: session.id,
      customerId: session.customer,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      paymentStatus: session.payment_status
    });

    // Validate session structure
    if (!session || !session.id) {
      console.error('Invalid session structure:', session);
      return res.status(400).json({ 
        error: 'Invalid session structure',
        received: false 
      });
    }

    try {
      let checkoutSession;
      try {
        checkoutSession = await prisma.checkoutSession.create({
          data: {
            stripeSessionId: session.id,
            customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
            customerEmail: session.customer_details?.email || null,
            amountTotal: session.amount_total || 0,
            currency: session.currency || 'usd',
            paymentStatus: session.payment_status || 'unknown',
          },
        });
        console.log('Checkout session saved to database:', session.id);
      } catch (dbError) {
        if (dbError instanceof Error && dbError.message.includes('Unique constraint')) {
          console.warn(`Checkout session ${session.id} already exists in database - may be a duplicate webhook`);
        } else {
          throw dbError;
        }
      }

      const customerEmail = session.customer_details?.email;
      if (customerEmail) {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
            expand: ['data.price.product'],
          });

          if (!lineItems || !lineItems.data) {
            console.warn(`No line items found for session ${session.id}`);
          } else {
            const astrologyProductPurchased = lineItems.data.some((item) => {
              const product = item.price?.product;
              if (typeof product === 'object' && product !== null) {
                const productObj = product as Stripe.Product;
                return (
                  productObj.id === 'prod_TUrnEqRRgTx9Gz' ||
                  productObj.name === 'Astrology Time Zone'
                );
              }
              return false;
            });

            if (astrologyProductPurchased) {
              try {
                const user = await prisma.user.findUnique({
                  where: { email: customerEmail },
                });

                if (user) {
                  await prisma.user.update({
                    where: { email: customerEmail },
                    data: { hasAstrology: true },
                  });
                  console.log(`Updated hasAstrology to true for user: ${customerEmail}`);
                } else {
                  // Create new user as NonMember with hasAstrology = true
                  const newUser = await prisma.user.create({
                    data: {
                      email: customerEmail,
                      firstName: session.customer_details?.name?.split(' ')[0] || 'Unknown',
                      lastName: session.customer_details?.name?.split(' ').slice(1).join(' ') || 'User',
                      userType: 'NonMember',
                      hasAstrology: true,
                    },
                  });
                  console.log(`Created new NonMember user with hasAstrology=true: ${customerEmail}`, newUser);
                }
              } catch (userError) {
                const error = userError as Error;
                console.error(`Failed to update/create user for ${customerEmail}:`, {
                  error: error.message,
                  sessionId: session.id,
                  stack: error.stack
                });
                // Don't fail the webhook - log and continue
              }
            }
          }
        } catch (stripeError) {
          const error = stripeError as Error;
          console.error(`Failed to fetch line items for session ${session.id}:`, {
            error: error.message,
            stack: error.stack
          });
        }
      }
      
      return res.status(200).json({ 
        received: true,
        sessionId: session.id,
        processed: true
      });
    } catch (error) {
      const err = error as Error;
      console.error('Critical error processing webhook:', {
        error: err.message,
        sessionId: session.id,
        stack: err.stack,
        eventType: event.type
      });
      
      // Return 500 so Stripe will retry
      return res.status(500).json({ 
        error: 'Internal server error processing webhook',
        received: true,
        processed: false,
        sessionId: session.id
      });
    }
  }

  return res.status(200).json({ received: true });
});

app.use(express.json());


app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

