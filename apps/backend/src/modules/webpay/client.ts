import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk"

import type { WebpayOptions } from "./types"

export type WebpayCreateResult = {
  token: string
  url: string
}

export type WebpayTransactionResult = Record<string, unknown>

export type WebpayTransactionClient = {
  create(
    buyOrder: string,
    sessionId: string,
    amount: number,
    returnUrl: string
  ): Promise<WebpayCreateResult>
  commit(token: string): Promise<WebpayTransactionResult>
  status(token: string): Promise<WebpayTransactionResult>
  refund(token: string, amount: number): Promise<WebpayTransactionResult>
}

export function createWebpayTransaction(options: WebpayOptions) {
  const transaction =
    (options.environment ?? "integration") === "production"
      ? new WebpayPlus.Transaction(
          new Options(
            options.commerce_code!,
            options.api_key!,
            Environment.Production
          )
        )
      : new WebpayPlus.Transaction(
          new Options(
            IntegrationCommerceCodes.WEBPAY_PLUS,
            IntegrationApiKeys.WEBPAY,
            Environment.Integration
          )
        )

  return {
    create: (buyOrder: string, sessionId: string, amount: number, returnUrl: string) =>
      transaction.create(buyOrder, sessionId, amount, returnUrl),
    commit: (token: string) => transaction.commit(token),
    status: (token: string) => transaction.status(token),
    refund: (token: string, amount: number) =>
      transaction.refund(token, amount),
  }
}

export function webpayOptionsFromEnv(): WebpayOptions {
  return {
    environment:
      process.env.WEBPAY_ENVIRONMENT === "production"
        ? "production"
        : "integration",
    commerce_code: process.env.WEBPAY_COMMERCE_CODE,
    api_key: process.env.WEBPAY_API_KEY,
    return_url:
      process.env.WEBPAY_RETURN_URL ??
      "http://localhost:9000/webpay/return",
  }
}
