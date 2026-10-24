export type WebpayEnvironment = "integration" | "production"

export type WebpayOptions = {
  environment?: WebpayEnvironment
  commerce_code?: string
  api_key?: string
  return_url: string
}

export type WebpayPaymentData = {
  token_ws?: string
  webpay_url?: string
  buy_order?: string
  session_id?: string
  cart_id?: string
  amount?: number
  currency_code?: string
  external_status?: string
  response_code?: number
  authorization_code?: string
  transaction_date?: string
  payment_type_code?: string
  installments_number?: number
  refund_type?: string
  refund_response_code?: number
  refunded_amount?: number
  rollback_refund?: boolean
}
