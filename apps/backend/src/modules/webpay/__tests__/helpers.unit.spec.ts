import { MedusaError } from "@medusajs/framework/utils"

import {
  assertApprovedCommit,
  assertClpCurrency,
  createBuyOrder,
  createSessionId,
  mapWebpayStatus,
  toClpIntegerAmount,
} from "../helpers"

describe("Webpay helpers", () => {
  test("accepts positive integer CLP amount", () => {
    expect(toClpIntegerAmount(16500)).toBe(16500)
  })

  test("rejects zero, negative and fractional amounts", () => {
    expect(() => toClpIntegerAmount(0)).toThrow(MedusaError)
    expect(() => toClpIntegerAmount(-1)).toThrow(MedusaError)
    expect(() => toClpIntegerAmount(10.5)).toThrow(MedusaError)
    expect(() => toClpIntegerAmount(Number.POSITIVE_INFINITY)).toThrow(
      MedusaError
    )
    expect(() => toClpIntegerAmount(true)).toThrow(MedusaError)
  })

  test("accepts only CLP", () => {
    expect(() => assertClpCurrency("clp")).not.toThrow()
    expect(() => assertClpCurrency("usd")).toThrow(MedusaError)
  })

  test("buy_order respects Webpay max length", () => {
    expect(createBuyOrder(1234567890, 0.123).length).toBeLessThanOrEqual(26)
  })

  test("cart id is a valid session id", () => {
    expect(createSessionId("cart_01ABC")).toBe("cart_01ABC")
  })

  test("rejects session ids longer than 61 chars", () => {
    expect(() => createSessionId("x".repeat(62))).toThrow(MedusaError)
  })

  test("approved commit requires AUTHORIZED + response_code=0 + exact identity", () => {
    expect(() =>
      assertApprovedCommit(
        {
          status: "AUTHORIZED",
          response_code: 0,
          amount: 16500,
          buy_order: "NENI-X",
          session_id: "cart_1",
        },
        {
          amount: 16500,
          buy_order: "NENI-X",
          session_id: "cart_1",
        }
      )
    ).not.toThrow()
  })

  test("rejects mismatched amount even if Webpay says authorized", () => {
    expect(() =>
      assertApprovedCommit(
        {
          status: "AUTHORIZED",
          response_code: 0,
          amount: 16000,
          buy_order: "NENI-X",
          session_id: "cart_1",
        },
        {
          amount: 16500,
          buy_order: "NENI-X",
          session_id: "cart_1",
        }
      )
    ).toThrow(MedusaError)
  })

  test("maps external statuses conservatively", () => {
    expect(mapWebpayStatus("INITIALIZED")).toBe("pending")
    expect(mapWebpayStatus("AUTHORIZED")).toBe("captured")
    expect(mapWebpayStatus("FAILED")).toBe("error")
    expect(mapWebpayStatus("REVERSED")).toBe("canceled")
  })
})
