// @ts-nocheck
// ===========================================
// Braintree Payment Service
// ===========================================

import braintree from 'braintree';
import { prisma } from '../../db/prisma.js';
import logger from '../../utils/logger.js';

// Get Braintree configuration from database
async function getBraintreeConfig() {
  const settings = await prisma.paymentSettings.findFirst();

  if (!settings?.braintreeEnabled || !settings.braintreeMerchantId ||
      !settings.braintreePublicKey || !settings.braintreePrivateKey) {
    throw new Error('Braintree is not configured');
  }

  return {
    merchantId: settings.braintreeMerchantId,
    publicKey: settings.braintreePublicKey,
    privateKey: settings.braintreePrivateKey,
    testMode: settings.braintreeTestMode
  };
}

// Get Braintree gateway instance
async function getBraintreeGateway(): Promise<braintree.BraintreeGateway> {
  const config = await getBraintreeConfig();

  return new braintree.BraintreeGateway({
    environment: config.testMode ? braintree.Environment.Sandbox : braintree.Environment.Production,
    merchantId: config.merchantId,
    publicKey: config.publicKey,
    privateKey: config.privateKey
  });
}

// ===========================================
// CLIENT TOKEN
// ===========================================

export async function generateClientToken(customerId?: string): Promise<string> {
  const gateway = await getBraintreeGateway();

  const options: braintree.ClientTokenRequest = {};
  if (customerId) {
    options.customerId = customerId;
  }

  const result = await gateway.clientToken.generate(options);

  if (!result.clientToken) {
    throw new Error('Failed to generate client token');
  }

  logger.info({ customerId }, 'Braintree client token generated');
  return result.clientToken;
}

// ===========================================
// CUSTOMER MANAGEMENT
// ===========================================

export async function createCustomer(
  email: string,
  firstName?: string,
  lastName?: string
): Promise<braintree.Customer> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.customer.create({
    email,
    firstName,
    lastName
  });

  if (!result.success || !result.customer) {
    throw new Error(result.message || 'Failed to create customer');
  }

  logger.info({ customerId: result.customer.id, email }, 'Braintree customer created');
  return result.customer;
}

export async function getCustomer(customerId: string): Promise<braintree.Customer | null> {
  const gateway = await getBraintreeGateway();

  try {
    return await gateway.customer.find(customerId);
  } catch (error) {
    logger.error({ customerId, error }, 'Failed to find Braintree customer');
    return null;
  }
}

export async function updateCustomer(
  customerId: string,
  data: { email?: string; firstName?: string; lastName?: string }
): Promise<braintree.Customer> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.customer.update(customerId, data);

  if (!result.success || !result.customer) {
    throw new Error(result.message || 'Failed to update customer');
  }

  return result.customer;
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const gateway = await getBraintreeGateway();
  await gateway.customer.delete(customerId);
  logger.info({ customerId }, 'Braintree customer deleted');
}

// ===========================================
// TRANSACTIONS
// ===========================================

export async function createTransaction(
  amount: number, // in dollars
  paymentMethodNonce: string,
  options?: {
    customerId?: string;
    orderId?: string;
    deviceData?: string;
    submitForSettlement?: boolean;
  }
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway();

  const transactionRequest: braintree.TransactionRequest = {
    amount: amount.toFixed(2),
    paymentMethodNonce,
    options: {
      submitForSettlement: options?.submitForSettlement ?? true
    }
  };

  if (options?.customerId) {
    transactionRequest.customerId = options.customerId;
  }
  if (options?.orderId) {
    transactionRequest.orderId = options.orderId;
  }
  if (options?.deviceData) {
    transactionRequest.deviceData = options.deviceData;
  }

  const result = await gateway.transaction.sale(transactionRequest);

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Transaction failed');
  }

  logger.info({
    transactionId: result.transaction.id,
    amount,
    status: result.transaction.status
  }, 'Braintree transaction created');

  // Record the transaction
  await prisma.payment.create({
    data: {
      amount: parseFloat(result.transaction.amount),
      currency: result.transaction.currencyIsoCode || 'USD',
      status: result.transaction.status === 'submitted_for_settlement' ? 'pending' :
              result.transaction.status === 'settled' ? 'completed' : result.transaction.status,
      method: 'card',
      transactionId: result.transaction.id,
      description: `Braintree payment: ${result.transaction.id}`
    }
  });

  return result.transaction;
}

export async function getTransaction(transactionId: string): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway();
  return gateway.transaction.find(transactionId);
}

export async function voidTransaction(transactionId: string): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.transaction.void(transactionId);

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Failed to void transaction');
  }

  logger.info({ transactionId }, 'Braintree transaction voided');
  return result.transaction;
}

export async function submitForSettlement(
  transactionId: string,
  amount?: number
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.transaction.submitForSettlement(
    transactionId,
    amount?.toFixed(2)
  );

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Failed to submit for settlement');
  }

  logger.info({ transactionId }, 'Braintree transaction submitted for settlement');
  return result.transaction;
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundTransaction(
  transactionId: string,
  amount?: number // in dollars, partial refund if provided
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.transaction.refund(
    transactionId,
    amount?.toFixed(2)
  );

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Refund failed');
  }

  const refundAmount = parseFloat(result.transaction.amount);

  logger.info({
    transactionId,
    refundId: result.transaction.id,
    amount: refundAmount
  }, 'Braintree refund created');

  // Record the refund
  await prisma.payment.create({
    data: {
      amount: refundAmount,
      currency: result.transaction.currencyIsoCode || 'USD',
      status: 'refunded',
      method: 'card',
      transactionId: result.transaction.id,
      description: `Braintree refund for: ${transactionId}`
    }
  });

  return result.transaction;
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

export async function createSubscription(
  paymentMethodToken: string,
  planId: string,
  options?: {
    price?: number;
    firstBillingDate?: Date;
  }
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway();

  const subscriptionRequest: braintree.SubscriptionRequest = {
    paymentMethodToken,
    planId
  };

  if (options?.price) {
    subscriptionRequest.price = options.price.toFixed(2);
  }
  if (options?.firstBillingDate) {
    subscriptionRequest.firstBillingDate = options.firstBillingDate;
  }

  const result = await gateway.subscription.create(subscriptionRequest);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to create subscription');
  }

  logger.info({
    subscriptionId: result.subscription.id,
    planId
  }, 'Braintree subscription created');

  return result.subscription;
}

export async function getSubscription(subscriptionId: string): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway();
  return gateway.subscription.find(subscriptionId);
}

export async function updateSubscription(
  subscriptionId: string,
  data: { price?: number; planId?: string }
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway();

  const updateRequest: braintree.SubscriptionRequest = {};
  if (data.price) {
    updateRequest.price = data.price.toFixed(2);
  }
  if (data.planId) {
    updateRequest.planId = data.planId;
  }

  const result = await gateway.subscription.update(subscriptionId, updateRequest);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to update subscription');
  }

  return result.subscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.subscription.cancel(subscriptionId);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to cancel subscription');
  }

  logger.info({ subscriptionId }, 'Braintree subscription cancelled');
  return result.subscription;
}

// ===========================================
// PAYMENT METHODS
// ===========================================

export async function createPaymentMethod(
  customerId: string,
  paymentMethodNonce: string,
  options?: {
    makeDefault?: boolean;
    verifyCard?: boolean;
  }
): Promise<braintree.PaymentMethod> {
  const gateway = await getBraintreeGateway();

  const result = await gateway.paymentMethod.create({
    customerId,
    paymentMethodNonce,
    options: {
      makeDefault: options?.makeDefault,
      verifyCard: options?.verifyCard
    }
  });

  if (!result.success || !result.paymentMethod) {
    throw new Error(result.message || 'Failed to create payment method');
  }

  logger.info({
    customerId,
    paymentMethodToken: result.paymentMethod.token
  }, 'Braintree payment method created');

  return result.paymentMethod;
}

export async function deletePaymentMethod(token: string): Promise<void> {
  const gateway = await getBraintreeGateway();
  await gateway.paymentMethod.delete(token);
  logger.info({ token }, 'Braintree payment method deleted');
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handleWebhookEvent(
  signature: string,
  payload: string
): Promise<{ handled: boolean; type: string }> {
  const gateway = await getBraintreeGateway();

  const webhookNotification = await gateway.webhookNotification.parse(signature, payload);
  const kind = webhookNotification.kind;

  logger.info({ kind }, 'Braintree webhook received');

  switch (kind) {
    case braintree.WebhookNotification.Kind.SubscriptionCanceled:
    case braintree.WebhookNotification.Kind.SubscriptionExpired:
    case braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully:
    case braintree.WebhookNotification.Kind.SubscriptionChargedUnsuccessfully:
      logger.info({
        kind,
        subscriptionId: webhookNotification.subscription?.id
      }, 'Braintree subscription event');
      return { handled: true, type: kind };

    case braintree.WebhookNotification.Kind.TransactionSettled:
    case braintree.WebhookNotification.Kind.TransactionSettlementDeclined:
      logger.info({
        kind,
        transactionId: webhookNotification.transaction?.id
      }, 'Braintree transaction event');
      return { handled: true, type: kind };

    default:
      logger.info({ kind }, 'Unhandled Braintree webhook event');
      return { handled: false, type: kind };
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testBraintreeConnection(): Promise<{
  success: boolean;
  message: string;
  merchantId?: string;
  testMode?: boolean;
}> {
  try {
    const config = await getBraintreeConfig();
    const gateway = await getBraintreeGateway();

    // Test by generating a client token
    const result = await gateway.clientToken.generate({});

    if (!result.clientToken) {
      throw new Error('Failed to generate client token');
    }

    return {
      success: true,
      message: `Connected to Braintree merchant: ${config.merchantId}`,
      merchantId: config.merchantId,
      testMode: config.testMode
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Braintree connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.paymentSettings.findFirst();
    return settings?.braintreeEnabled || false;
  } catch {
    return false;
  }
}
