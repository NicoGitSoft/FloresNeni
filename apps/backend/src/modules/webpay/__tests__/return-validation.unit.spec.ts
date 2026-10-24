import {
  assertCompletedReturnState,
  assertReturnTransaction,
  classifyReturnTokens,
  selectReturnSession,
} from "../return-validation"

const session = {
  provider_id: "pp_webpay_webpay",
  amount: 16500,
  status: "pending",
  data: {
    token_ws: "token-current",
    amount: 16500,
    buy_order: "NENI-TEST",
    session_id: "cart_test",
  },
}

const initialized = {
  status: "INITIALIZED",
  amount: 16500,
  buy_order: "NENI-TEST",
  session_id: "cart_test",
}

describe("Webpay return validation", () => {
  test("requires a completed Cart, authorized session, and linked Order", () => {
    expect(() =>
      assertCompletedReturnState({
        orderId: "order_test",
        cartCompleted: true,
        paymentSessionStatus: "authorized",
        paymentCollectionLinked: true,
      })
    ).not.toThrow()

    for (const invalidState of [
      { orderId: undefined, cartCompleted: true, paymentSessionStatus: "authorized", paymentCollectionLinked: true },
      { orderId: "order_test", cartCompleted: false, paymentSessionStatus: "authorized", paymentCollectionLinked: true },
      { orderId: "order_test", cartCompleted: true, paymentSessionStatus: "pending", paymentCollectionLinked: true },
      { orderId: "order_test", cartCompleted: true, paymentSessionStatus: "authorized", paymentCollectionLinked: false },
    ]) {
      expect(() => assertCompletedReturnState(invalidState)).toThrow()
    }
  })

  test("classifies abort, payment, missing, and conflicting callback tokens", () => {
    expect(classifyReturnTokens(undefined, "abort-token")).toBe("aborted")
    expect(classifyReturnTokens("payment-token")).toBe("payment")
    expect(classifyReturnTokens()).toBe("missing")
    expect(classifyReturnTokens("payment-token", "abort-token")).toBe("invalid")
  })

  test("selects the exact session matching callback token and current Cart", () => {
    expect(
      selectReturnSession(
        [session],
        "token-current",
        "cart_test",
        16500,
        "clp"
      )
    ).toEqual({
      amount: 16500,
      buy_order: "NENI-TEST",
      session_id: "cart_test",
    })
  })

  test("rejects a stale token when another session is current", () => {
    expect(() =>
      selectReturnSession(
        [{ ...session, data: { ...session.data, token_ws: "token-new" } }],
        "token-current",
        "cart_test",
        16500,
        "clp"
      )
    ).toThrow()
  })

  test("rejects ambiguous duplicate sessions for the callback token", () => {
    expect(() =>
      selectReturnSession(
        [session, session],
        "token-current",
        "cart_test",
        16500,
        "clp"
      )
    ).toThrow()
  })

  test("rejects multiple processable payment providers", () => {
    expect(() =>
      selectReturnSession(
        [
          session,
          {
            provider_id: "pp_system_default",
            amount: 16500,
            status: "pending",
            data: {},
          },
        ],
        "token-current",
        "cart_test",
        16500,
        "clp"
      )
    ).toThrow()
  })

  test("rejects changed Cart totals and non-CLP carts", () => {
    expect(() =>
      selectReturnSession(
        [session],
        "token-current",
        "cart_test",
        17000,
        "clp"
      )
    ).toThrow()
    expect(() =>
      selectReturnSession(
        [session],
        "token-current",
        "cart_test",
        16500,
        "usd"
      )
    ).toThrow()
  })

  test("rejects remote transaction identity mismatches", () => {
    expect(() =>
      assertReturnTransaction(
        { ...initialized, buy_order: "NENI-OTHER" },
        {
          amount: 16500,
          buy_order: "NENI-TEST",
          session_id: "cart_test",
        }
      )
    ).toThrow()
  })

  test("accepts matching INITIALIZED and AUTHORIZED remote states only", () => {
    const expected = {
      amount: 16500,
      buy_order: "NENI-TEST",
      session_id: "cart_test",
    }

    expect(() => assertReturnTransaction(initialized, expected)).not.toThrow()
    expect(() =>
      assertReturnTransaction(
        { ...initialized, ...{ status: "AUTHORIZED", response_code: 0 } },
        expected
      )
    ).not.toThrow()
    expect(() =>
      assertReturnTransaction(
        { ...initialized, status: "FAILED" },
        expected
      )
    ).toThrow()
  })
})
