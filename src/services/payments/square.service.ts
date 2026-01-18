// ===========================================
// Square Payment Service
// ===========================================

import { Client, Environment } from 'square';
import { prisma } from '../../db/prisma';
import logger from '../../utils/logger';
import { randomUUID } from 'crypto';

// Get Square configuration from database
async function getSquareConfig() {
  const settings = await prisma.paymentSettings.findFirst();

  if (!settings?.squareEnabled || !settings.squareAccessToken) {
    throw new Error('Square is not configured');
  }

  return {
    accessToken: settings.squareAccessToken,
    applicationId: settings.squareAppId,
    locationId: settings.squareLocationId,
    sandbox: settings.squareSandbox,
    webhookSignature: settings.squareWebhookSignature
  };
}

// Get Square client
async function getSquareClient(): Promise<Client> {
  const config = await getSquareConfig();

  return new Client({
    accessToken: config.accessToken,
    environment: config.sandbox ? Environment.Sandbox : Environment.Production
  });
}

// ===========================================
// PAYMENTS
// ===========================================

export async function createPayment(
  sourceId: string, // Payment source (card nonce or customer card ID)
  amount: number, // in cents
  currency: string = 'USD',
  locationId?: string,
  customerId?: string,
  note?: string,
  metadata?: Record<string, string>
): Promise<{
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
}> {
  const config = await getSquareConfig();
  const client = await getSquareClient();

  const idempotencyKey = randomUUID();
  const effectiveLocationId = locationId || config.locationId;

  if (!effectiveLocationId) {
    throw new Error('Square location ID is required');
  }

  const response = await client.paymentsApi.createPayment({
    sourceId,
    idempotencyKey,
    amountMoney: {
      amount: BigInt(amount),
      currency
    },
    locationId: effectiveLocationId,
    customerId,
    note,
    referenceId: metadata?.orderId
  });

  const payment = response.result.payment;
  if (!payment) {
    throw new Error('Failed to create Square payment');
  }

  logger.info({
    paymentId: payment.id,
    amount,
    status: payment.status
  }, 'Square payment created');

  // Record the transaction
  await prisma.payment.create({
    data: {
      amount: amount / 100,
      currency,
      status: payment.status === 'COMPLETED' ? 'completed' : 'pending',
      method: 'card',
      transactionId: payment.id,
      description: `Square payment: ${payment.id}`
    }
  });

  return {
    paymentId: payment.id || '',
    status: payment.status || 'UNKNOWN',
    amount,
    currency,
    receiptUrl: payment.receiptUrl
  };
}

export async function getPayment(paymentId: string): Promise<{
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
}> {
  const client = await getSquareClient();

  const response = await client.paymentsApi.getPayment(paymentId);
  const payment = response.result.payment;

  if (!payment) {
    throw new Error('Payment not found');
  }

  return {
    paymentId: payment.id || '',
    status: payment.status || 'UNKNOWN',
    amount: Number(payment.amountMoney?.amount || 0),
    currency: payment.amountMoney?.currency || 'USD',
    receiptUrl: payment.receiptUrl
  };
}

export async function cancelPayment(paymentId: string): Promise<{
  paymentId: string;
  status: string;
}> {
  const client = await getSquareClient();

  const response = await client.paymentsApi.cancelPayment(paymentId);
  const payment = response.result.payment;

  logger.info({ paymentId }, 'Square payment cancelled');

  return {
    paymentId: payment?.id || paymentId,
    status: payment?.status || 'CANCELLED'
  };
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundPayment(
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<{
  refundId: string;
  status: string;
  amount: number;
}> {
  const client = await getSquareClient();
  const idempotencyKey = randomUUID();

  // Get original payment to get currency and amount if not specified
  const originalPayment = await getPayment(paymentId);

  const refundAmount = amount || originalPayment.amount;

  const response = await client.refundsApi.refundPayment({
    idempotencyKey,
    paymentId,
    amountMoney: {
      amount: BigInt(refundAmount),
      currency: originalPayment.currency
    },
    reason
  });

  const refund = response.result.refund;
  if (!refund) {
    throw new Error('Failed to create Square refund');
  }

  logger.info({
    refundId: refund.id,
    paymentId,
    amount: refundAmount
  }, 'Square refund created');

  // Record the refund
  await prisma.payment.create({
    data: {
      amount: refundAmount / 100,
      currency: originalPayment.currency,
      status: 'refunded',
      method: 'card',
      transactionId: refund.id,
      description: `Square refund for payment: ${paymentId}`
    }
  });

  return {
    refundId: refund.id || '',
    status: refund.status || 'UNKNOWN',
    amount: refundAmount
  };
}

// ===========================================
// CUSTOMERS
// ===========================================

export async function createCustomer(
  email: string,
  givenName?: string,
  familyName?: string,
  phone?: string
): Promise<{ customerId: string; email: string }> {
  const client = await getSquareClient();
  const idempotencyKey = randomUUID();

  const response = await client.customersApi.createCustomer({
    idempotencyKey,
    emailAddress: email,
    givenName,
    familyName,
    phoneNumber: phone
  });

  const customer = response.result.customer;
  if (!customer) {
    throw new Error('Failed to create Square customer');
  }

  logger.info({ customerId: customer.id, email }, 'Square customer created');

  return {
    customerId: customer.id || '',
    email: customer.emailAddress || email
  };
}

export async function getCustomer(customerId: string): Promise<{
  customerId: string;
  email?: string;
  givenName?: string;
  familyName?: string;
} | null> {
  const client = await getSquareClient();

  try {
    const response = await client.customersApi.retrieveCustomer(customerId);
    const customer = response.result.customer;

    if (!customer) return null;

    return {
      customerId: customer.id || '',
      email: customer.emailAddress ?? undefined,
      givenName: customer.givenName ?? undefined,
      familyName: customer.familyName ?? undefined
    };
  } catch {
    return null;
  }
}

// ===========================================
// LOCATIONS
// ===========================================

export async function listLocations(): Promise<Array<{
  id: string;
  name: string;
  status: string;
}>> {
  const client = await getSquareClient();

  const response = await client.locationsApi.listLocations();
  const locations = response.result.locations || [];

  return locations.map(loc => ({
    id: loc.id || '',
    name: loc.name || '',
    status: loc.status || 'UNKNOWN'
  }));
}

// ===========================================
// WEBHOOKS
// ===========================================

export async function handleSquareWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  logger.info({ eventType }, 'Processing Square webhook');

  switch (eventType) {
    case 'payment.completed':
      logger.info({ data: payload.data }, 'Payment completed');
      break;
    case 'payment.updated':
      logger.info({ data: payload.data }, 'Payment updated');
      break;
    case 'refund.created':
    case 'refund.updated':
      logger.info({ data: payload.data }, 'Refund event');
      break;
    default:
      logger.info({ eventType }, 'Unhandled Square event');
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testSquareConnection(): Promise<{
  success: boolean;
  message: string;
  sandbox?: boolean;
  locationId?: string;
}> {
  try {
    const config = await getSquareConfig();
    const locations = await listLocations();

    if (locations.length === 0) {
      return {
        success: false,
        message: 'Connected to Square but no locations found'
      };
    }

    return {
      success: true,
      message: `Connected to Square with ${locations.length} location(s)`,
      sandbox: config.sandbox,
      locationId: config.locationId || locations[0].id
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Square connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.paymentSettings.findFirst();
    return settings?.squareEnabled || false;
  } catch {
    return false;
  }
}
