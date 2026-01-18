// Type declarations for modules without types

declare module 'authorizenet' {
  export const APIContracts: {
    MerchantAuthenticationType: new () => any;
    PaymentType: new () => any;
    CreditCardType: new () => any;
    BankAccountType: new () => any;
    TransactionRequestType: new () => any;
    CreateTransactionRequest: new () => any;
    RefundTransactionRequest: new () => any;
    ARBSubscriptionType: new () => any;
    ARBCreateSubscriptionRequest: new () => any;
    ARBCancelSubscriptionRequest: new () => any;
    PaymentScheduleType: new () => any;
    PaymentScheduleTypeIntervalAUnitEnum: {
      DAYS: string;
      MONTHS: string;
    };
    CustomerProfilePaymentType: new () => any;
    CustomerAddressType: new () => any;
    GetTransactionDetailsRequest: new () => any;
    GetTransactionListRequest: new () => any;
    BatchStatisticsTypeEnum: any;
    CreateCustomerProfileRequest: new () => any;
    CustomerType: new () => any;
    CustomerPaymentProfileType: new () => any;
  };

  export const APIControllers: {
    CreateTransactionController: new (request: any) => any;
    ARBCreateSubscriptionController: new (request: any) => any;
    ARBCancelSubscriptionController: new (request: any) => any;
    GetTransactionDetailsController: new (request: any) => any;
    GetTransactionListController: new (request: any) => any;
    CreateCustomerProfileController: new (request: any) => any;
  };

  export const Constants: {
    endpoint: {
      production: string;
      sandbox: string;
    };
  };
}
