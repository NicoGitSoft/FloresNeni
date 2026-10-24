import type { Logger } from "@medusajs/framework/types"

import WebpayPaymentProviderService from "../service"
import type { WebpayTransactionClient } from "../client"

const paymentData = {
  token_ws: "safe-test-token",
  amount: 16500,
  buy_order: "NENI-TEST",
  session_id: "cart_test",
}

const authorized = {
  status: "AUTHORIZED",
  response_code: 0,
  amount: 16500,
  buy_order: "NENI-TEST",
  session_id: "cart_test",
}

function createService(transaction: Partial<WebpayTransactionClient>) {
  const client = {
    create: jest.fn(),
    commit: jest.fn(),
    status: jest.fn(),
    refund: jest.fn(),
    ...transaction,
  } as WebpayTransactionClient

  const logger = { error: jest.fn() } as unknown as Logger
  const provider = new WebpayPaymentProviderService(
    { logger },
    { environment: "integration", return_url: "http://localhost/return" },
    client
  )

  return { provider, client, logger }
}

async function authorize(provider: WebpayPaymentProviderService) {
  return provider.authorizePayment({
    data: paymentData,
  } as Parameters<WebpayPaymentProviderService["authorizePayment"]>[0])
}

describe("Webpay provider runtime construction", () => {
  test("does not resolve the test-only transaction client from the Awilix cradle", () => {
    const logger = { error: jest.fn() } as unknown as Logger
    const cradle = new Proxy(
      { logger },
      {
        get(target, property, receiver) {
          if (Reflect.has(target, property)) {
            return Reflect.get(target, property, receiver)
          }

          throw new Error(`Could not resolve '${String(property)}'`)
        },
      }
    )

    expect(
      () =>
        new WebpayPaymentProviderService(
          cradle,
          {
            environment: "integration",
            return_url: "http://localhost/return",
          }
        )
    ).not.toThrow()
  })
})

describe("Webpay authorization recovery", () => {
  test("does not recommit when remote status is already AUTHORIZED", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue(authorized),
    })

    await expect(authorize(provider)).resolves.toMatchObject({
      status: "captured",
    })
    expect(client.commit).not.toHaveBeenCalled()
    expect(client.status).toHaveBeenCalledTimes(1)
  })

  test("commits once when remote status is INITIALIZED", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        status: "INITIALIZED",
        response_code: -1,
      }),
      commit: jest.fn().mockResolvedValue(authorized),
    })

    await expect(authorize(provider)).resolves.toMatchObject({
      status: "captured",
    })
    expect(client.commit).toHaveBeenCalledTimes(1)
  })

  test("recovers an ambiguous commit from matching AUTHORIZED status", async () => {
    const { provider, client } = createService({
      status: jest
        .fn()
        .mockResolvedValueOnce({
          ...authorized,
          status: "INITIALIZED",
          response_code: -1,
        })
        .mockResolvedValueOnce(authorized),
      commit: jest.fn().mockRejectedValue(new Error("network timeout")),
    })

    await expect(authorize(provider)).resolves.toMatchObject({
      status: "captured",
    })
    expect(client.commit).toHaveBeenCalledTimes(1)
    expect(client.status).toHaveBeenCalledTimes(2)
  })

  test.each(["FAILED", "INITIALIZED"])(
    "does not approve an ambiguous commit when status remains %s",
    async (status) => {
      const { provider, client } = createService({
        status: jest
          .fn()
          .mockResolvedValueOnce({
            ...authorized,
            status: "INITIALIZED",
            response_code: -1,
          })
          .mockResolvedValueOnce({
            ...authorized,
            status,
            response_code: -1,
          }),
        commit: jest.fn().mockRejectedValue(new Error("network timeout")),
      })

      await expect(authorize(provider)).rejects.toThrow()
      expect(client.commit).toHaveBeenCalledTimes(1)
    }
  )

  test("fails closed when the initial remote status cannot be read", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockRejectedValue(new Error("status unavailable")),
    })

    await expect(authorize(provider)).rejects.toThrow("requiere conciliación")
    expect(client.commit).not.toHaveBeenCalled()
  })

  test("does not commit an authorized transaction with mismatched identity", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        session_id: "cart_other",
      }),
    })

    await expect(authorize(provider)).rejects.toThrow()
    expect(client.commit).not.toHaveBeenCalled()
  })
})

describe("Webpay refunds", () => {
  function refund(provider: WebpayPaymentProviderService, amount: number) {
    return provider.refundPayment({
      amount,
      data: paymentData,
      context: { idempotency_key: "medusa-refund-key" },
    } as Parameters<WebpayPaymentProviderService["refundPayment"]>[0])
  }

  test("accepts a confirmed NULLIFIED refund with response_code zero", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        balance: 16500,
      }),
      refund: jest.fn().mockResolvedValue({
        type: "NULLIFIED",
        response_code: 0,
        nullified_amount: 5000,
      }),
    })

    await expect(refund(provider, 5000)).resolves.toMatchObject({
      data: {
        refund_type: "NULLIFIED",
        refunded_amount: 5000,
      },
    })
    expect(client.refund).toHaveBeenCalledWith("safe-test-token", 5000)
  })

  test("does not refund when remote balance is insufficient", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        balance: 4000,
      }),
    })

    await expect(refund(provider, 5000)).rejects.toThrow("saldo remoto")
    expect(client.refund).not.toHaveBeenCalled()
  })

  test("does not refund when the remote transaction identity differs", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        buy_order: "NENI-OTHER",
        balance: 16500,
      }),
    })

    await expect(refund(provider, 5000)).rejects.toThrow()
    expect(client.refund).not.toHaveBeenCalled()
  })

  test("rejects an unsuccessful NULLIFIED response code", async () => {
    const { provider, client } = createService({
      status: jest.fn().mockResolvedValue({
        ...authorized,
        balance: 16500,
      }),
      refund: jest.fn().mockResolvedValue({
        type: "NULLIFIED",
        response_code: 1,
        nullified_amount: 5000,
      }),
    })

    await expect(refund(provider, 5000)).rejects.toThrow("no confirmó")
    expect(client.refund).toHaveBeenCalledTimes(1)
  })
})

describe("Webpay transaction creation", () => {
  function initiate(provider: WebpayPaymentProviderService) {
    return provider.initiatePayment({
      amount: 16500,
      currency_code: "clp",
      data: { cart_id: "cart_test" },
    } as Parameters<WebpayPaymentProviderService["initiatePayment"]>[0])
  }

  test("stores a valid server-created token and HTTPS redirect URL", async () => {
    const { provider, client } = createService({
      create: jest.fn().mockResolvedValue({
        token: "current-webpay-token",
        url: "https://webpay.example/transaction",
      }),
    })

    await expect(initiate(provider)).resolves.toMatchObject({
      id: "current-webpay-token",
      data: {
        token_ws: "current-webpay-token",
        webpay_url: "https://webpay.example/transaction",
        session_id: "cart_test",
        amount: 16500,
        currency_code: "clp",
      },
    })
    expect(client.create).toHaveBeenCalledWith(
      expect.any(String),
      "cart_test",
      16500,
      "http://localhost/return"
    )
  })

  test("does not expose raw provider errors or accept malformed redirects", async () => {
    const { provider: failed } = createService({
      create: jest
        .fn()
        .mockRejectedValue(new Error("private provider response token")),
    })
    await expect(initiate(failed)).rejects.toThrow(
      "No se pudo iniciar la transacción Webpay"
    )

    const { provider: malformed } = createService({
      create: jest.fn().mockResolvedValue({
        token: "current-webpay-token",
        url: "javascript:alert(1)",
      }),
    })
    await expect(initiate(malformed)).rejects.toThrow()
  })
})

describe("Webpay retrieval data exposure", () => {
  test("does not copy raw status payload/card details into payment data", async () => {
    const { provider } = createService({
      status: jest.fn().mockResolvedValue({
        status: "AUTHORIZED",
        card_detail: { card_number: "ending-1234" },
        authorization_code: "private-auth-code",
      }),
    })

    const result = await provider.retrievePayment({
      data: paymentData,
    } as Parameters<WebpayPaymentProviderService["retrievePayment"]>[0])

    expect(result.data).toMatchObject({
      ...paymentData,
      external_status: "AUTHORIZED",
    })
    expect(result.data).not.toHaveProperty("card_detail")
    expect(result.data).not.toHaveProperty("authorization_code")
  })
})

describe("Webpay cancellation compensation", () => {
  test("does not refund again after remote status becomes NULLIFIED", async () => {
    const { provider, client } = createService({
      status: jest
        .fn()
        .mockResolvedValueOnce({
          ...authorized,
          balance: 16500,
        })
        .mockResolvedValueOnce({
          ...authorized,
          status: "NULLIFIED",
          balance: 0,
        }),
      refund: jest.fn().mockResolvedValue({
        type: "REVERSED",
        balance: 0,
      }),
    })
    const input = {
      data: paymentData,
    } as Parameters<WebpayPaymentProviderService["cancelPayment"]>[0]

    await provider.cancelPayment(input)
    const retry = await provider.cancelPayment(input)

    expect(client.refund).toHaveBeenCalledTimes(1)
    expect(retry.data).toMatchObject({ external_status: "NULLIFIED" })
  })
})
