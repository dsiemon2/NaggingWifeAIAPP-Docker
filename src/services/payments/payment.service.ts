// ===========================================
// Unified Payment Service
// Coordinates between Stripe, PayPal, Square, Braintree, and Authorize.net
// ===========================================

import { prisma } from '../../db/prisma';
import logger from '../../utils/logger';
import * as stripeService from './stripe.service';
import * as paypalService from './paypal.service';
import * as squareService from './square.service';
import * as braintreeService from './braintree.service';
import * as authorizeService from './authorize.service';

export type PaymentProvider = 'stripe' | 'paypal' | 'square' | 'braintree' | 'authorize';

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  provider: PaymentProvider;
  refundId: string;
  status: string;
  amount: number;
  error?: string;
}

// ===========================================
// CONFIGURATION HELPERS
// ===========================================

export async function getEnabledGateways(): Promise<{
  stripe: boolean;
  paypal: boolean;
  square: boolean;
  braintree: boolean;
  authorize: boolean;
  anyEnabled: boolean;
}> {
  const settings = await prisma.paymentSettings.findFirst();

  const stripe = settings?.stripeEnabled || false;
  const paypal = settings?.paypalEnabled || false;
  const square = settings?.squareEnabled || false;
  const braintree = settings?.braintreeEnabled || false;
  const authorize = settings?.authorizeEnabled || false;

  return {
    stripe,
    paypal,
    square,
    braintree,
    authorize,
    anyEnabled: stripe || paypal || square || braintree || authorize
  };
}

export async function getDefaultGateway(): Promise<PaymentProvider | null> {
  const gateways = await getEnabledGateways();

  // Return first enabled gateway (priority: Stripe > PayPal > Braintree > Square > Authorize.net)
  if (gateways.stripe) return 'stripe';
  if (gateways.paypal) return 'paypal';
  if (gateways.braintree) return 'braintree';
  if (gateways.square) return 'square';
  if (gateways.authorize) return 'authorize';

  return null;
}

// ===========================================
// PAYMENT PROCESSING
// ===========================================

export async function processPayment(
  provider: PaymentProvider,
  amount: number, // in cents
  currency: string = 'USD',
  options: {
    sourceId?: string; // Card token/nonce
    customerId?: string;
    customerEmail?: string;
    description?: string;
    metadata?: Record<string, string>;
    // Square-specific
    locationId?: string;
    // PayPal-specific
    returnUrl?: string;
    cancelUrl?: string;
    items?: Array<{ name: string; quantity: number; unitAmount: number }>;
  }
): Promise<PaymentResult> {
  try {
    switch (provider) {
      case 'stripe': {
        const paymentIntent = await stripeService.createPaymentIntent(
          amount,
          currency,
          options.customerId,
          options.metadata
        );

        return {
          success: true,
          provider: 'stripe',
          transactionId: paymentIntent.id,
          status: paymentIntent.status,
          amount,
          currency,
          metadata: { clientSecret: paymentIntent.client_secret }
        };
      }

      case 'paypal': {
        if (!options.returnUrl || !options.cancelUrl) {
          throw new Error('PayPal requires returnUrl and cancelUrl');
        }

        const items = options.items || [{
          name: options.description || 'Payment',
          quantity: 1,
          unitAmount: amount / 100 // Convert cents to dollars
        }];

        const order = await paypalService.createOrder(
          items,
          options.returnUrl,
          options.cancelUrl,
          options.metadata
        );

        return {
          success: true,
          provider: 'paypal',
          transactionId: order.orderId,
          status: order.status,
          amount,
          currency,
          metadata: { approvalUrl: order.approvalUrl }
        };
      }

      case 'square': {
        if (!options.sourceId) {
          throw new Error('Square requires sourceId (card nonce)');
        }

        const payment = await squareService.createPayment(
          options.sourceId,
          amount,
          currency,
          options.locationId,
          options.customerId,
          options.description,
          options.metadata
        );

        return {
          success: true,
          provider: 'square',
          transactionId: payment.paymentId,
          status: payment.status,
          amount,
          currency,
          metadata: { receiptUrl: payment.receiptUrl }
        };
      }

      case 'braintree': {
        if (!options.sourceId) {
          throw new Error('Braintree requires sourceId (payment method nonce)');
        }

        const transaction = await braintreeService.createTransaction(
          amount / 100, // Convert cents to dollars for Braintree
          options.sourceId,
          {
            customerId: options.customerId,
            orderId: options.metadata?.orderId,
            submitForSettlement: true
          }
        );

        return {
          success: true,
          provider: 'braintree',
          transactionId: transaction.id,
          status: transaction.status,
          amount,
          currency,
          metadata: { processorResponseCode: transaction.processorResponseCode }
        };
      }

      case 'authorize': {
        if (!options.sourceId) {
          throw new Error('Authorize.net requires card information');
        }

        // Parse card info from sourceId (format: cardNumber|expDate|cvv)
        const [cardNumber, expirationDate, cardCode] = options.sourceId.split('|');

        const result = await authorizeService.chargeCard(
          { cardNumber, expirationDate, cardCode },
          amount / 100, // Convert cents to dollars
          {
            email: options.customerEmail,
            description: options.description,
            invoiceNumber: options.metadata?.invoiceNumber
          }
        );

        return {
          success: true,
          provider: 'authorize',
          transactionId: result.transactionId,
          status: 'succeeded',
          amount,
          currency,
          metadata: { authCode: result.authCode, avsResultCode: result.avsResultCode }
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ provider, error: err.message }, 'Payment processing failed');

    return {
      success: false,
      provider,
      transactionId: '',
      status: 'failed',
      amount,
      currency,
      error: err.message
    };
  }
}

// ===========================================
// CAPTURE PAYMENT
// ===========================================

export async function capturePayment(
  provider: PaymentProvider,
  transactionId: string
): Promise<PaymentResult> {
  try {
    switch (provider) {
      case 'stripe': {
        const paymentIntent = await stripeService.getPaymentIntent(transactionId);
        return {
          success: paymentIntent.status === 'succeeded',
          provider: 'stripe',
          transactionId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        };
      }

      case 'paypal': {
        const capture = await paypalService.captureOrder(transactionId);
        return {
          success: capture.status === 'COMPLETED',
          provider: 'paypal',
          transactionId: capture.transactionId,
          status: capture.status,
          amount: capture.amount * 100,
          currency: capture.currency
        };
      }

      case 'square': {
        const payment = await squareService.getPayment(transactionId);
        return {
          success: payment.status === 'COMPLETED',
          provider: 'square',
          transactionId: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency
        };
      }

      case 'braintree': {
        const transaction = await braintreeService.getTransaction(transactionId);
        if (transaction.status === 'authorized') {
          const settled = await braintreeService.submitForSettlement(transactionId);
          return {
            success: true,
            provider: 'braintree',
            transactionId: settled.id,
            status: settled.status,
            amount: parseFloat(settled.amount) * 100,
            currency: settled.currencyIsoCode || 'USD'
          };
        }
        return {
          success: transaction.status === 'submitted_for_settlement' || transaction.status === 'settled',
          provider: 'braintree',
          transactionId: transaction.id,
          status: transaction.status,
          amount: parseFloat(transaction.amount) * 100,
          currency: transaction.currencyIsoCode || 'USD'
        };
      }

      case 'authorize': {
        const result = await authorizeService.captureTransaction(transactionId);
        return {
          success: true,
          provider: 'authorize',
          transactionId: result.transactionId,
          status: 'captured',
          amount: 0,
          currency: 'USD'
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ provider, transactionId, error: err.message }, 'Payment capture failed');

    return {
      success: false,
      provider,
      transactionId,
      status: 'failed',
      amount: 0,
      currency: 'USD',
      error: err.message
    };
  }
}

// ===========================================
// REFUNDS
// ===========================================

export async function processRefund(
  provider: PaymentProvider,
  transactionId: string,
  amount?: number, // in cents, partial refund if provided
  reason?: string
): Promise<RefundResult> {
  try {
    switch (provider) {
      case 'stripe': {
        const refund = await stripeService.createRefund(
          transactionId,
          amount,
          reason as 'duplicate' | 'fraudulent' | 'requested_by_customer'
        );
        return {
          success: refund.status === 'succeeded',
          provider: 'stripe',
          refundId: refund.id,
          status: refund.status || 'unknown',
          amount: refund.amount || 0
        };
      }

      case 'paypal': {
        const refund = await paypalService.refundCapture(
          transactionId,
          amount ? amount / 100 : undefined,
          'USD',
          reason
        );
        return {
          success: refund.status === 'COMPLETED',
          provider: 'paypal',
          refundId: refund.refundId,
          status: refund.status,
          amount: refund.amount * 100
        };
      }

      case 'square': {
        const refund = await squareService.refundPayment(transactionId, amount, reason);
        return {
          success: refund.status === 'COMPLETED',
          provider: 'square',
          refundId: refund.refundId,
          status: refund.status,
          amount: refund.amount
        };
      }

      case 'braintree': {
        const transaction = await braintreeService.refundTransaction(
          transactionId,
          amount ? amount / 100 : undefined
        );
        return {
          success: transaction.status === 'submitted_for_settlement',
          provider: 'braintree',
          refundId: transaction.id,
          status: transaction.status,
          amount: parseFloat(transaction.amount) * 100
        };
      }

      case 'authorize': {
        // Authorize.net requires the last 4 digits for refunds
        // This would need to be passed in or retrieved from storage
        const result = await authorizeService.refundTransaction(
          transactionId,
          amount ? amount / 100 : 0,
          'XXXX' // Card last 4 would need to be stored/passed
        );
        return {
          success: true,
          provider: 'authorize',
          refundId: result.transactionId,
          status: 'refunded',
          amount: amount || 0
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ provider, transactionId, error: err.message }, 'Refund processing failed');

    return {
      success: false,
      provider,
      refundId: '',
      status: 'failed',
      amount: 0,
      error: err.message
    };
  }
}

// ===========================================
// TEST CONNECTIONS
// ===========================================

export async function testAllConnections(): Promise<{
  stripe: { success: boolean; message: string };
  paypal: { success: boolean; message: string };
  square: { success: boolean; message: string };
  braintree: { success: boolean; message: string };
  authorize: { success: boolean; message: string };
}> {
  const gateways = await getEnabledGateways();
  const results = {
    stripe: { success: false, message: 'Not enabled' },
    paypal: { success: false, message: 'Not enabled' },
    square: { success: false, message: 'Not enabled' },
    braintree: { success: false, message: 'Not enabled' },
    authorize: { success: false, message: 'Not enabled' }
  };

  if (gateways.stripe) {
    results.stripe = await stripeService.testStripeConnection();
  }

  if (gateways.paypal) {
    results.paypal = await paypalService.testPayPalConnection();
  }

  if (gateways.square) {
    results.square = await squareService.testSquareConnection();
  }

  if (gateways.braintree) {
    results.braintree = await braintreeService.testBraintreeConnection();
  }

  if (gateways.authorize) {
    results.authorize = await authorizeService.testAuthorizeConnection();
  }

  return results;
}

// ===========================================
// TRANSACTION QUERIES
// ===========================================

export async function getTransactions(options: {
  status?: string;
  method?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string | null;
    transactionId: string | null;
    description: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = {};

  if (options.status) where.status = options.status;
  if (options.method) where.method = options.method;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) (where.createdAt as Record<string, unknown>).gte = options.startDate;
    if (options.endDate) (where.createdAt as Record<string, unknown>).lte = options.endDate;
  }

  const [transactions, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0
    }),
    prisma.payment.count({ where })
  ]);

  return {
    transactions: transactions.map(t => ({
      id: t.id,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      method: t.method,
      transactionId: t.transactionId,
      description: t.description,
      createdAt: t.createdAt
    })),
    total
  };
}

export async function getTransactionStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  byMethod: Record<string, number>;
}> {
  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, unknown>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, unknown>).lte = endDate;
  }

  const transactions = await prisma.payment.findMany({
    where,
    select: {
      amount: true,
      status: true,
      method: true
    }
  });

  let totalRevenue = 0;
  let successfulTransactions = 0;
  let failedTransactions = 0;
  let refundedAmount = 0;
  const byMethod: Record<string, number> = {};

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const method = tx.method || 'other';

    if (tx.status === 'completed') {
      totalRevenue += amount;
      successfulTransactions++;
    }
    if (tx.status === 'failed') {
      failedTransactions++;
    }
    if (tx.status === 'refunded') {
      refundedAmount += amount;
    }

    byMethod[method] = (byMethod[method] || 0) + amount;
  }

  return {
    totalRevenue,
    totalTransactions: transactions.length,
    successfulTransactions,
    failedTransactions,
    refundedAmount,
    byMethod
  };
}

// ===========================================
// WEBHOOK ROUTING
// ===========================================

export async function handleWebhook(
  provider: PaymentProvider,
  eventType: string,
  payload: unknown
): Promise<void> {
  logger.info({ provider, eventType }, 'Processing payment webhook');

  switch (provider) {
    case 'stripe':
      // Stripe webhooks are handled via stripeService.handleWebhookEvent
      break;
    case 'paypal':
      await paypalService.handlePayPalWebhook(eventType, payload as Record<string, unknown>);
      break;
    case 'square':
      await squareService.handleSquareWebhook(eventType, payload as Record<string, unknown>);
      break;
    case 'braintree':
      // Braintree webhooks require signature and payload
      logger.info({ eventType }, 'Braintree webhook received');
      break;
    case 'authorize':
      await authorizeService.handleWebhookEvent(eventType, payload as Record<string, unknown>);
      break;
  }
}
