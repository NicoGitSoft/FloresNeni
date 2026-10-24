import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils"

import {
  createWebpayTransaction,
  type WebpayCreateResult,
  type WebpayTransactionClient,
} from "./client"
import {
  assertApprovedCommit,
  assertClpCurrency,
  assertTransactionIdentity,
  createBuyOrder,
  createSessionId,
  mapWebpayStatus,
  toClpIntegerAmount,
} from "./helpers"
import type { WebpayOptions, WebpayPaymentData } from "./types"

type InjectedDependencies = {
  logger: Logger
}

function record(data: Record<string, unknown> | undefined): WebpayPaymentData {
  return (data ?? {}) as WebpayPaymentData
}

function transactionIdentity(data: WebpayPaymentData) {
  if (
    typeof data.amount !== "number" ||
    typeof data.buy_order !== "string" ||
    typeof data.session_id !== "string"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La sesión Webpay no contiene una identidad de transacción válida."
    )
  }

  return {
    amount: toClpIntegerAmount(data.amount),
    buy_order: data.buy_order,
    session_id: data.session_id,
  }
}

function plain<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export default class WebpayPaymentProviderService extends AbstractPaymentProvider<WebpayOptions> {
  static identifier = "webpay"

  protected logger_: Logger
  protected options_: WebpayOptions
  protected transaction_: WebpayTransactionClient

  constructor(
    container: InjectedDependencies,
    options: WebpayOptions,
    transaction?: WebpayTransactionClient
  ) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = {
      environment: "integration",
      ...options,
    }
    this.transaction_ =
      transaction ?? createWebpayTransaction(this.options_)
  }

  static validateOptions(options: Record<string, unknown>): void {
    const environment =
      options.environment === "production" ? "production" : "integration"
    const returnUrl = String(options.return_url ?? "")

    if (!returnUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WEBPAY_RETURN_URL es obligatoria."
      )
    }

    if (returnUrl.length > 256) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WEBPAY_RETURN_URL excede 256 caracteres."
      )
    }

    if (environment === "production") {
      if (!options.commerce_code || !options.api_key) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY son obligatorios en producción."
        )
      }

      const url = new URL(returnUrl)
      if (url.protocol !== "https:") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "WEBPAY_RETURN_URL debe usar HTTPS en producción."
        )
      }
    }
  }

  private async createRemotePayment(
    amountInput: unknown,
    currencyCode: string | undefined,
    inputData: Record<string, unknown> | undefined
  ) {
    assertClpCurrency(currencyCode)
    const amount = toClpIntegerAmount(amountInput)
    const data = record(inputData)

    const buyOrder = createBuyOrder()
    const sessionId = createSessionId(
      typeof data.cart_id === "string" ? data.cart_id : undefined
    )

    let response: WebpayCreateResult
    try {
      response = await this.transaction_.create(
        buyOrder,
        sessionId,
        amount,
        this.options_.return_url
      )
    } catch {
      this.logger_.error("Webpay transaction initialization failed")
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No se pudo iniciar la transacción Webpay."
      )
    }

    let redirectUrl: URL
    try {
      redirectUrl = new URL(response.url)
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Webpay devolvió una URL de pago inválida."
      )
    }
    if (
      typeof response.token !== "string" ||
      response.token.length === 0 ||
      redirectUrl.protocol !== "https:"
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Webpay devolvió una respuesta de inicialización inválida."
      )
    }

    return {
      id: response.token,
      data: {
        ...data,
        token_ws: response.token,
        webpay_url: redirectUrl.toString(),
        buy_order: buyOrder,
        session_id: sessionId,
        cart_id: sessionId.startsWith("cart_") ? sessionId : data.cart_id,
        amount,
        currency_code: "clp",
        external_status: "INITIALIZED",
      } satisfies WebpayPaymentData,
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    return this.createRemotePayment(
      input.amount,
      input.currency_code,
      input.data
    )
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    // Webpay Plus no permite cambiar el monto de un token ya inicializado.
    // Creamos una transacción nueva para que la sesión Medusa quede alineada
    // con el total actual del carrito.
    return this.createRemotePayment(
      input.amount,
      input.currency_code,
      input.data
    )
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    // Una transacción Webpay inicializada no tiene operación "delete".
    // Si nunca se confirma, expirará del lado de Transbank.
    return { data: input.data }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = record(input.data)
    const token = data.token_ws
    if (typeof token !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "La sesión Webpay no contiene un token válido."
      )
    }

    const expected = transactionIdentity(data)
    let result: Record<string, unknown> | undefined

    try {
      const current = plain(await this.transaction_.status(token))
      if (current.status === "AUTHORIZED") {
        assertApprovedCommit(current, expected)
        result = current
      } else if (current.status === "INITIALIZED") {
        assertTransactionIdentity(current, expected)
        let committed: Record<string, unknown> | undefined
        try {
          committed = plain(await this.transaction_.commit(token))
        } catch {
          const recovered = plain(await this.transaction_.status(token))
          assertApprovedCommit(recovered, expected)
          result = recovered
        }
        if (committed) {
          try {
            assertApprovedCommit(committed, expected)
            result = committed
          } catch {
            const recovered = plain(await this.transaction_.status(token))
            assertApprovedCommit(recovered, expected)
            result = recovered
          }
        }
      } else {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "El estado remoto Webpay no permite autorizar este pago."
        )
      }
    } catch {
      this.logger_.error("Webpay authorization could not be reconciled")
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No fue posible verificar el estado final del pago Webpay; requiere conciliación."
      )
    }

    if (!result) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No se pudo confirmar el resultado de autorización Webpay; requiere conciliación."
      )
    }
    assertApprovedCommit(result, expected)

    return {
      status: "captured" as PaymentSessionStatus,
      data: {
        ...data,
        external_status: String(result.status ?? "AUTHORIZED"),
        response_code: Number(result.response_code ?? 0),
        authorization_code:
          typeof result.authorization_code === "string"
            ? result.authorization_code
            : undefined,
        transaction_date:
          typeof result.transaction_date === "string"
            ? result.transaction_date
            : undefined,
        payment_type_code:
          typeof result.payment_type_code === "string"
            ? result.payment_type_code
            : undefined,
        installments_number:
          typeof result.installments_number === "number"
            ? result.installments_number
            : undefined,
      },
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Webpay Plus normal es captura simultánea. No repetimos una captura.
    const data = record(input.data)
    const token = data.token_ws
    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Falta token Webpay para verificar captura."
      )
    }

    const status = plain(await this.transaction_.status(token))
    assertTransactionIdentity(status, transactionIdentity(data))
    if (!["AUTHORIZED", "CAPTURED", "PARTIALLY_NULLIFIED"].includes(String(status.status))) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Webpay no está capturado/autorizado (status=${String(status.status)}).`
      )
    }

    return {
      data: {
        ...data,
        external_status: String(status.status),
      },
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = record(input.data)
    const token = data.token_ws
    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Falta token Webpay para refund."
      )
    }

    const amount = toClpIntegerAmount(input.amount)
    const current = plain(await this.transaction_.status(token))
    assertTransactionIdentity(current, transactionIdentity(data))
    const refundableBalance = current.balance
    if (
      !["AUTHORIZED", "CAPTURED", "PARTIALLY_NULLIFIED"].includes(
        String(current.status)
      ) ||
      typeof refundableBalance !== "number" ||
      !Number.isSafeInteger(refundableBalance) ||
      refundableBalance < amount
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "El saldo remoto de Webpay no confirma que el monto pueda reembolsarse; requiere conciliación."
      )
    }

    const result = plain(await this.transaction_.refund(token, amount))
    if (
      result.type !== "REVERSED" &&
      !(result.type === "NULLIFIED" && result.response_code === 0)
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Webpay no confirmó el reembolso; requiere conciliación."
      )
    }

    return {
      data: {
        ...data,
        refund_type:
          typeof result.type === "string" ? result.type : undefined,
        refund_response_code:
          typeof result.response_code === "number"
            ? result.response_code
            : undefined,
        refunded_amount:
          typeof result.nullified_amount === "number"
            ? result.nullified_amount
            : amount,
      },
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = record(input.data)
    const token = data.token_ws
    if (!token) {
      return { data: input.data }
    }

    const status = plain(await this.transaction_.status(token))
    return {
      data: {
        ...data,
        external_status:
          typeof status.status === "string"
            ? status.status
            : data.external_status,
      },
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    const data = record(input.data)
    const token = data.token_ws

    if (!token) {
      return { data: input.data }
    }

    const status = plain(await this.transaction_.status(token))
    const externalStatus = String(status.status ?? "")

    if (["AUTHORIZED", "CAPTURED", "PARTIALLY_NULLIFIED"].includes(externalStatus)) {
      assertTransactionIdentity(status, transactionIdentity(data))
      if (
        typeof status.balance !== "number" ||
        !Number.isSafeInteger(status.balance) ||
        status.balance <= 0
      ) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Webpay no informó un saldo reembolsable verificable."
        )
      }
      const refund = plain(
        await this.transaction_.refund(token, status.balance)
      )
      if (
        refund.type !== "REVERSED" &&
        !(refund.type === "NULLIFIED" && refund.response_code === 0)
      ) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Webpay no confirmó el reembolso de compensación; requiere conciliación."
        )
      }
      return {
        data: {
          ...data,
          external_status: externalStatus,
          rollback_refund: true,
        },
      }
    }

    return {
      data: {
        ...data,
        external_status: externalStatus || data.external_status,
      },
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = record(input.data)
    const token = data.token_ws

    if (!token) {
      return { status: "pending" as PaymentSessionStatus }
    }

    const status = await this.transaction_.status(token)
    return {
      status: mapWebpayStatus(
        typeof status.status === "string" ? status.status : undefined
      ) as PaymentSessionStatus,
    }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    // Webpay Plus clásico usa return_url + commit, no un webhook asíncrono
    // equivalente a Stripe. El retorno se procesa en /webpay/return.
    return {
      action: PaymentActions.NOT_SUPPORTED,
      data: {
        session_id: "",
        amount: new BigNumber(0),
      },
    }
  }
}
