import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk"

import type { WebpayOptions } from "./types"

export function createWebpayTransaction(options: WebpayOptions) {
  if ((options.environment ?? "integration") === "production") {
    return new WebpayPlus.Transaction(
      new Options(
        options.commerce_code!,
        options.api_key!,
        Environment.Production
      )
    )
  }

  return new WebpayPlus.Transaction(
    new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration
    )
  )
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
