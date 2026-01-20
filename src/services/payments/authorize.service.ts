// @ts-nocheck
// ===========================================
// Authorize.net Payment Service
// ===========================================

import { APIContracts, APIControllers, Constants } from 'authorizenet';
import { prisma } from '../../db/prisma.js';
import logger from '../../utils/logger.js';

// Get Authorize.net configuration from database
async function getAuthorizeConfig() {
  const settings = await prisma.paymentSettings.findFirst();

  if (!settings?.authorizeEnabled || !settings.authorizeApiLoginId || !settings.authorizeTransactionKey) {
    throw new Error('Authorize.net is not configured');
  }

  return {
    apiLoginId: settings.authorizeApiLoginId,
    transactionKey: settings.authorizeTransactionKey,
    testMode: settings.authorizeTestMode,
    signatureKey: settings.authorizeSignatureKey
  };
}

// Create merchant authentication
async function getMerchantAuth(): Promise<APIContracts.MerchantAuthenticationType> {
  const config = await getAuthorizeConfig();

  const merchantAuth = new APIContracts.MerchantAuthenticationType();
  merchantAuth.setName(config.apiLoginId);
  merchantAuth.setTransactionKey(config.transactionKey);

  return merchantAuth;
}

// Get API endpoint
async function getEndpoint(): Promise<string> {
  const config = await getAuthorizeConfig();
  return config.testMode
    ? Constants.endpoint.sandbox
    : Constants.endpoint.production;
}

// ===========================================
// CHARGE CARD
// ===========================================

export async function chargeCard(
  cardInfo: {
    cardNumber: string;
    expirationDate: string; // MMYY format
    cardCode: string;
  },
  amount: number, // in dollars
  options?: {
    email?: string;
    description?: string;
    invoiceNumber?: string;
    customerId?: string;
  }
): Promise<{
  transactionId: string;
  authCode: string;
  responseCode: string;
  avsResultCode?: string;
}> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  // Create credit card
  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(cardInfo.cardNumber);
  creditCard.setExpirationDate(cardInfo.expirationDate);
  creditCard.setCardCode(cardInfo.cardCode);

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  // Create order
  const order = new APIContracts.OrderType();
  if (options?.invoiceNumber) {
    order.setInvoiceNumber(options.invoiceNumber);
  }
  if (options?.description) {
    order.setDescription(options.description);
  }

  // Create transaction
  const transactionRequest = new APIContracts.TransactionRequestType();
  transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount);
  transactionRequest.setOrder(order);

  if (options?.email) {
    const customer = new APIContracts.CustomerDataType();
    customer.setEmail(options.email);
    transactionRequest.setCustomer(customer);
  }

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateTransactionResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Transaction failed'));
        return;
      }

      const transactionResponse = apiResponse.getTransactionResponse();
      if (!transactionResponse) {
        reject(new Error('No transaction response'));
        return;
      }

      const transactionId = transactionResponse.getTransId();
      logger.info({ transactionId, amount }, 'Authorize.net charge successful');

      // Record the transaction
      prisma.payment.create({
        data: {
          amount,
          currency: 'USD',
          status: 'completed',
          method: 'card',
          transactionId,
          description: `Authorize.net payment: ${transactionId}`
        }
      }).catch(err => logger.error({ err }, 'Failed to record transaction'));

      resolve({
        transactionId,
        authCode: transactionResponse.getAuthCode(),
        responseCode: transactionResponse.getResponseCode(),
        avsResultCode: transactionResponse.getAvsResultCode()
      });
    });
  });
}

// ===========================================
// AUTHORIZE ONLY (No Capture)
// ===========================================

export async function authorizeCard(
  cardInfo: {
    cardNumber: string;
    expirationDate: string;
    cardCode: string;
  },
  amount: number,
  options?: {
    email?: string;
    description?: string;
    invoiceNumber?: string;
  }
): Promise<{
  transactionId: string;
  authCode: string;
}> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(cardInfo.cardNumber);
  creditCard.setExpirationDate(cardInfo.expirationDate);
  creditCard.setCardCode(cardInfo.cardCode);

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const transactionRequest = new APIContracts.TransactionRequestType();
  transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHONLYTRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount);

  if (options?.description) {
    const order = new APIContracts.OrderType();
    order.setDescription(options.description);
    transactionRequest.setOrder(order);
  }

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateTransactionResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Authorization failed'));
        return;
      }

      const transactionResponse = apiResponse.getTransactionResponse();
      if (!transactionResponse) {
        reject(new Error('No transaction response'));
        return;
      }

      logger.info({ transactionId: transactionResponse.getTransId(), amount }, 'Authorize.net authorization successful');

      resolve({
        transactionId: transactionResponse.getTransId(),
        authCode: transactionResponse.getAuthCode()
      });
    });
  });
}

// ===========================================
// CAPTURE TRANSACTION
// ===========================================

export async function captureTransaction(
  transactionId: string,
  amount?: number
): Promise<{ transactionId: string; responseCode: string }> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const transactionRequest = new APIContracts.TransactionRequestType();
  transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.PRIORAUTHCAPTURETRANSACTION);
  transactionRequest.setRefTransId(transactionId);

  if (amount) {
    transactionRequest.setAmount(amount);
  }

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateTransactionResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Capture failed'));
        return;
      }

      const transactionResponse = apiResponse.getTransactionResponse();
      logger.info({ transactionId }, 'Authorize.net capture successful');

      resolve({
        transactionId: transactionResponse?.getTransId() || transactionId,
        responseCode: transactionResponse?.getResponseCode() || ''
      });
    });
  });
}

// ===========================================
// REFUND TRANSACTION
// ===========================================

export async function refundTransaction(
  transactionId: string,
  amount: number,
  cardNumber: string // Last 4 digits
): Promise<{ transactionId: string; responseCode: string }> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(cardNumber);
  creditCard.setExpirationDate('XXXX');

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const transactionRequest = new APIContracts.TransactionRequestType();
  transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.REFUNDTRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount);
  transactionRequest.setRefTransId(transactionId);

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateTransactionResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Refund failed'));
        return;
      }

      const transactionResponse = apiResponse.getTransactionResponse();
      const refundTransId = transactionResponse?.getTransId() || '';

      logger.info({ originalTransactionId: transactionId, refundTransactionId: refundTransId, amount }, 'Authorize.net refund successful');

      // Record the refund
      prisma.payment.create({
        data: {
          amount,
          currency: 'USD',
          status: 'refunded',
          method: 'card',
          transactionId: refundTransId,
          description: `Authorize.net refund for: ${transactionId}`
        }
      }).catch(err => logger.error({ err }, 'Failed to record refund'));

      resolve({
        transactionId: refundTransId,
        responseCode: transactionResponse?.getResponseCode() || ''
      });
    });
  });
}

// ===========================================
// VOID TRANSACTION
// ===========================================

export async function voidTransaction(
  transactionId: string
): Promise<{ transactionId: string; responseCode: string }> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const transactionRequest = new APIContracts.TransactionRequestType();
  transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.VOIDTRANSACTION);
  transactionRequest.setRefTransId(transactionId);

  const createRequest = new APIContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateTransactionResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Void failed'));
        return;
      }

      const transactionResponse = apiResponse.getTransactionResponse();
      logger.info({ transactionId }, 'Authorize.net void successful');

      resolve({
        transactionId: transactionResponse?.getTransId() || transactionId,
        responseCode: transactionResponse?.getResponseCode() || ''
      });
    });
  });
}

// ===========================================
// GET TRANSACTION DETAILS
// ===========================================

export async function getTransactionDetails(
  transactionId: string
): Promise<{
  transactionId: string;
  status: string;
  amount: number;
  submitTime: string;
  responseCode: string;
}> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const getRequest = new APIContracts.GetTransactionDetailsRequest();
  getRequest.setMerchantAuthentication(merchantAuth);
  getRequest.setTransId(transactionId);

  const ctrl = new APIControllers.GetTransactionDetailsController(getRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.GetTransactionDetailsResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Failed to get transaction details'));
        return;
      }

      const transaction = apiResponse.getTransaction();
      resolve({
        transactionId: transaction.getTransId(),
        status: transaction.getTransactionStatus(),
        amount: transaction.getSettleAmount(),
        submitTime: transaction.getSubmitTimeUTC(),
        responseCode: transaction.getResponseCode().toString()
      });
    });
  });
}

// ===========================================
// CUSTOMER PROFILES
// ===========================================

export async function createCustomerProfile(
  email: string,
  description?: string
): Promise<{ customerProfileId: string }> {
  const merchantAuth = await getMerchantAuth();
  const endpoint = await getEndpoint();

  const customerProfile = new APIContracts.CustomerProfileType();
  customerProfile.setEmail(email);
  if (description) {
    customerProfile.setDescription(description);
  }

  const createRequest = new APIContracts.CreateCustomerProfileRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setProfile(customerProfile);

  const ctrl = new APIControllers.CreateCustomerProfileController(createRequest.getJSON());
  ctrl.setEnvironment(endpoint);

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const response = ctrl.getResponse();
      const apiResponse = new APIContracts.CreateCustomerProfileResponse(response);

      if (apiResponse.getMessages().getResultCode() !== APIContracts.MessageTypeEnum.OK) {
        const errors = apiResponse.getMessages().getMessage();
        reject(new Error(errors[0]?.getText() || 'Failed to create customer profile'));
        return;
      }

      logger.info({ customerProfileId: apiResponse.getCustomerProfileId(), email }, 'Authorize.net customer profile created');

      resolve({
        customerProfileId: apiResponse.getCustomerProfileId()
      });
    });
  });
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handleWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  logger.info({ eventType }, 'Processing Authorize.net webhook');

  switch (eventType) {
    case 'net.authorize.payment.authcapture.created':
      logger.info({ payload }, 'Auth capture created');
      break;
    case 'net.authorize.payment.capture.created':
      logger.info({ payload }, 'Capture created');
      break;
    case 'net.authorize.payment.refund.created':
      logger.info({ payload }, 'Refund created');
      break;
    case 'net.authorize.payment.void.created':
      logger.info({ payload }, 'Void created');
      break;
    default:
      logger.info({ eventType }, 'Unhandled Authorize.net webhook');
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testAuthorizeConnection(): Promise<{
  success: boolean;
  message: string;
  testMode?: boolean;
}> {
  try {
    const config = await getAuthorizeConfig();
    const merchantAuth = await getMerchantAuth();
    const endpoint = await getEndpoint();

    const getRequest = new APIContracts.GetMerchantDetailsRequest();
    getRequest.setMerchantAuthentication(merchantAuth);

    const ctrl = new APIControllers.GetMerchantDetailsController(getRequest.getJSON());
    ctrl.setEnvironment(endpoint);

    return new Promise((resolve) => {
      ctrl.execute(() => {
        const response = ctrl.getResponse();
        const apiResponse = new APIContracts.GetMerchantDetailsResponse(response);

        if (apiResponse.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
          resolve({
            success: true,
            message: 'Successfully connected to Authorize.net',
            testMode: config.testMode
          });
        } else {
          const errors = apiResponse.getMessages().getMessage();
          resolve({
            success: false,
            message: `Authorize.net connection failed: ${errors[0]?.getText() || 'Unknown error'}`
          });
        }
      });
    });
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Authorize.net connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.paymentSettings.findFirst();
    return settings?.authorizeEnabled || false;
  } catch {
    return false;
  }
}
