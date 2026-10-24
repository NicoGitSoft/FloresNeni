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

import { createWebpayTransaction } from "./client"
import {
  assertApprovedCommit,
  assertClpCurrency,
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

function plain<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export default class WebpayPaymentProviderService extends AbstractPaymentProvider<WebpayOptions> {
  static identifier = "webpay"

  protected logger_: Logger
  protected options_: WebpayOptions
  protected transaction_: ReturnType<typeof createWebpayTransaction>

  constructor(container: InjectedDependencies, options: WebpayOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = {
      environment: "integration",
      ...options,
    }
    this.transaction_ = createWebpayTransaction(this.options_)
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

    const response = await this.transaction_.create(
      buyOrder,
      sessionId,
      amount,
      this.options_.return_url
    )

    return {
      id: response.token,
      data: {
        ...data,
        token_ws: response.token,
        webpay_url: response.url,
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
    try {
      return await this.createRemotePayment(
        input.amount,
        input.currency_code,
        input.data
      )
    } catch (error) {
      this.logger_.error("Webpay initiatePayment failed", error as Error)
      throw error
    }
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
    const amount = data.amount
    const buyOrder = data.buy_order
    const sessionId = data.session_id

    if (
      typeof token !== "string" ||
      typeof amount !== "number" ||
      typeof buyOrder !== "string" ||
      typeof sessionId !== "string"
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "La sesión Webpay no contiene token/monto/buy_order/session_id válidos."
      )
    }

    let result: Record<string, unknown>

    try {
      result = plain(await this.transaction_.commit(token))
    } catch (commitError) {
      // Un retry después de una confirmación exitosa puede recibir 422.
      // Antes de fallar, consultamos status para resolver el estado real.
      try {
        result = plain(await this.transaction_.status(token))
      } catch {
        throw commitError
      }
    }

    assertApprovedCommit(
      result as {
        amount?: number
        status?: string
        response_code?: number
        buy_order?: string
        session_id?: string
      },
      { amount, buy_order: buyOrder, session_id: sessionId }
    )

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
    const result = plain(await this.transaction_.refund(token, amount))

    return {
      data: {
        ...data,
        refund_type:
          typeof result.type === "string" ? result.type : undefined,
        refund_response_code:
          typeof result.response_code === "number"
            ? result.response_code
            : undefined,
        refunded_amount: amount,
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
        ...status,
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
      const refundable =
        typeof status.amount === "number"
          ? status.amount
          : typeof data.amount === "number"
            ? data.amount
            : 0

      if (refundable > 0) {
        await this.transaction_.refund(token, refundable)
        return {
          data: {
            ...data,
            external_status: externalStatus,
            rollback_refund: true,
          },
        }
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

    try {
      const status = await this.transaction_.status(token)
      return {
        status: mapWebpayStatus(status.status) as PaymentSessionStatus,
      }
    } catch {
      return { status: "pending" as PaymentSessionStatus }
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
