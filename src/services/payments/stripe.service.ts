// ===========================================
// Stripe Payment Service
// ===========================================

import Stripe from 'stripe';
import { prisma } from '../../db/prisma';
import logger from '../../utils/logger';

// Get Stripe configuration from database
async function getStripeConfig() {
  const settings = await prisma.paymentSettings.findFirst();

  if (!settings?.stripeEnabled || !settings.stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }

  return {
    secretKey: settings.stripeSecretKey,
    publishableKey: settings.stripePublishableKey,
    webhookSecret: settings.stripeWebhookSecret,
    testMode: settings.stripeTestMode
  };
}

// Get Stripe instance
async function getStripeInstance(): Promise<Stripe> {
  const config = await getStripeConfig();
  return new Stripe(config.secretKey, {
    apiVersion: '2025-02-24.acacia'
  });
}

// ===========================================
// PAYMENT INTENTS
// ===========================================

export async function createPaymentIntent(
  amount: number, // in cents
  currency: string = 'USD',
  customerId?: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeInstance();

  const params: Stripe.PaymentIntentCreateParams = {
    amount,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: metadata || {}
  };

  if (customerId) {
    params.customer = customerId;
  }

  const paymentIntent = await stripe.paymentIntents.create(params);
  logger.info({ paymentIntentId: paymentIntent.id, amount }, 'Stripe payment intent created');

  return paymentIntent;
}

export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeInstance();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeInstance();
  const canceled = await stripe.paymentIntents.cancel(paymentIntentId);
  logger.info({ paymentIntentId }, 'Stripe payment intent cancelled');
  return canceled;
}

// ===========================================
// CUSTOMERS
// ===========================================

export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = await getStripeInstance();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata
  });

  logger.info({ customerId: customer.id, email }, 'Stripe customer created');
  return customer;
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  const stripe = await getStripeInstance();
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.deleted ? null : customer as Stripe.Customer;
  } catch {
    return null;
  }
}

export async function updateCustomer(
  customerId: string,
  data: { email?: string; name?: string; metadata?: Record<string, string> }
): Promise<Stripe.Customer> {
  const stripe = await getStripeInstance();
  return stripe.customers.update(customerId, data);
}

// ===========================================
// REFUNDS
// ===========================================

export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> {
  const stripe = await getStripeInstance();

  const params: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId
  };

  if (amount) params.amount = amount;
  if (reason) params.reason = reason;

  const refund = await stripe.refunds.create(params);
  logger.info({ refundId: refund.id, paymentIntentId, amount }, 'Stripe refund created');

  return refund;
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  const stripe = await getStripeInstance();

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata
  });

  logger.info({ subscriptionId: subscription.id, customerId }, 'Stripe subscription created');
  return subscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = await getStripeInstance();
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  logger.info({ subscriptionId }, 'Stripe subscription cancelled');
  return subscription;
}

// ===========================================
// WEBHOOKS
// ===========================================

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const config = await getStripeConfig();
  const stripe = await getStripeInstance();

  if (!config.webhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, config.webhookSecret);
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  logger.info({ eventType: event.type, eventId: event.id }, 'Processing Stripe webhook');

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      logger.info({ subscriptionId: (event.data.object as Stripe.Subscription).id }, 'Subscription event');
      break;
    default:
      logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  logger.info({ paymentIntentId: paymentIntent.id, amount: paymentIntent.amount }, 'Payment succeeded');

  // Record the transaction
  await prisma.payment.create({
    data: {
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'completed',
      method: 'card',
      transactionId: paymentIntent.id,
      description: `Stripe payment: ${paymentIntent.id}`
    }
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  logger.error({ paymentIntentId: paymentIntent.id }, 'Payment failed');

  await prisma.payment.create({
    data: {
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'failed',
      method: 'card',
      transactionId: paymentIntent.id,
      description: `Failed Stripe payment: ${paymentIntent.id}`
    }
  });
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testStripeConnection(): Promise<{
  success: boolean;
  message: string;
  testMode?: boolean;
}> {
  try {
    const config = await getStripeConfig();
    const stripe = await getStripeInstance();

    // Test by retrieving balance
    await stripe.balance.retrieve();

    return {
      success: true,
      message: 'Successfully connected to Stripe',
      testMode: config.testMode
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Stripe connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.paymentSettings.findFirst();
    return settings?.stripeEnabled || false;
  } catch {
    return false;
  }
}
