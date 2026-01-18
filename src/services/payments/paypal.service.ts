// ===========================================
// PayPal Payment Service
// ===========================================

import { prisma } from '../../db/prisma';
import logger from '../../utils/logger';

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

// Get PayPal configuration from database
async function getPayPalConfig() {
  const settings = await prisma.paymentSettings.findFirst();

  if (!settings?.paypalEnabled || !settings.paypalClientId || !settings.paypalClientSecret) {
    throw new Error('PayPal is not configured');
  }

  return {
    clientId: settings.paypalClientId,
    clientSecret: settings.paypalClientSecret,
    sandbox: settings.paypalSandbox,
    webhookId: settings.paypalWebhookId
  };
}

// Get PayPal API base URL
async function getBaseUrl(): Promise<string> {
  const config = await getPayPalConfig();
  return config.sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

// Get access token
async function getAccessToken(): Promise<string> {
  const config = await getPayPalConfig();
  const baseUrl = await getBaseUrl();

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Failed to get PayPal access token: ${response.statusText}`);
  }

  const data = await response.json() as PayPalAccessToken;
  return data.access_token;
}

// ===========================================
// ORDERS
// ===========================================

export async function createOrder(
  items: Array<{ name: string; quantity: number; unitAmount: number }>,
  returnUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<{ orderId: string; status: string; approvalUrl: string }> {
  const baseUrl = await getBaseUrl();
  const accessToken = await getAccessToken();

  const totalAmount = items.reduce((sum, item) => sum + (item.unitAmount * item.quantity), 0);

  const orderData = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: totalAmount.toFixed(2),
        breakdown: {
          item_total: {
            currency_code: 'USD',
            value: totalAmount.toFixed(2)
          }
        }
      },
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity.toString(),
        unit_amount: {
          currency_code: 'USD',
          value: item.unitAmount.toFixed(2)
        }
      })),
      custom_id: metadata ? JSON.stringify(metadata) : undefined
    }],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      brand_name: 'Nagging Wife AI',
      user_action: 'PAY_NOW'
    }
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal order: ${error}`);
  }

  const order = await response.json() as PayPalOrder;
  const approvalUrl = order.links.find(link => link.rel === 'approve')?.href || '';

  logger.info({ orderId: order.id, amount: totalAmount }, 'PayPal order created');

  return {
    orderId: order.id,
    status: order.status,
    approvalUrl
  };
}

export async function captureOrder(orderId: string): Promise<{
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
}> {
  const baseUrl = await getBaseUrl();
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to capture PayPal order: ${error}`);
  }

  const data = await response.json() as {
    id: string;
    status: string;
    purchase_units: Array<{
      payments: {
        captures: Array<{
          id: string;
          amount: { value: string; currency_code: string };
        }>;
      };
    }>;
  };

  const capture = data.purchase_units[0]?.payments?.captures?.[0];
  const amount = capture ? parseFloat(capture.amount.value) : 0;
  const currency = capture?.amount?.currency_code || 'USD';

  logger.info({ orderId, transactionId: capture?.id, amount }, 'PayPal order captured');

  // Record the transaction
  await prisma.payment.create({
    data: {
      amount,
      currency,
      status: 'completed',
      method: 'paypal',
      transactionId: capture?.id || orderId,
      description: `PayPal payment: ${orderId}`
    }
  });

  return {
    transactionId: capture?.id || orderId,
    status: data.status,
    amount,
    currency
  };
}

export async function getOrder(orderId: string): Promise<{
  orderId: string;
  status: string;
  amount: number;
  currency: string;
}> {
  const baseUrl = await getBaseUrl();
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get PayPal order: ${response.statusText}`);
  }

  const data = await response.json() as {
    id: string;
    status: string;
    purchase_units: Array<{
      amount: { value: string; currency_code: string };
    }>;
  };

  const amount = parseFloat(data.purchase_units[0]?.amount?.value || '0');
  const currency = data.purchase_units[0]?.amount?.currency_code || 'USD';

  return {
    orderId: data.id,
    status: data.status,
    amount,
    currency
  };
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundCapture(
  captureId: string,
  amount?: number,
  currency: string = 'USD',
  note?: string
): Promise<{ refundId: string; status: string; amount: number }> {
  const baseUrl = await getBaseUrl();
  const accessToken = await getAccessToken();

  const refundData: Record<string, unknown> = {};
  if (amount) {
    refundData.amount = {
      value: amount.toFixed(2),
      currency_code: currency
    };
  }
  if (note) {
    refundData.note_to_payer = note;
  }

  const response = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(refundData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refund PayPal capture: ${error}`);
  }

  const data = await response.json() as {
    id: string;
    status: string;
    amount: { value: string };
  };

  const refundAmount = parseFloat(data.amount?.value || '0');
  logger.info({ captureId, refundId: data.id, amount: refundAmount }, 'PayPal refund created');

  // Record the refund
  await prisma.payment.create({
    data: {
      amount: refundAmount,
      currency,
      status: 'refunded',
      method: 'paypal',
      transactionId: data.id,
      description: `PayPal refund for capture: ${captureId}`
    }
  });

  return {
    refundId: data.id,
    status: data.status,
    amount: refundAmount
  };
}

// ===========================================
// WEBHOOKS
// ===========================================

export async function handlePayPalWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  logger.info({ eventType }, 'Processing PayPal webhook');

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      logger.info({ resource: payload.resource }, 'Payment capture completed');
      break;
    case 'PAYMENT.CAPTURE.REFUNDED':
      logger.info({ resource: payload.resource }, 'Payment refunded');
      break;
    case 'CHECKOUT.ORDER.APPROVED':
      logger.info({ resource: payload.resource }, 'Order approved');
      break;
    default:
      logger.info({ eventType }, 'Unhandled PayPal event');
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testPayPalConnection(): Promise<{
  success: boolean;
  message: string;
  sandbox?: boolean;
}> {
  try {
    const config = await getPayPalConfig();
    await getAccessToken();

    return {
      success: true,
      message: 'Successfully connected to PayPal',
      sandbox: config.sandbox
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `PayPal connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.paymentSettings.findFirst();
    return settings?.paypalEnabled || false;
  } catch {
    return false;
  }
}
