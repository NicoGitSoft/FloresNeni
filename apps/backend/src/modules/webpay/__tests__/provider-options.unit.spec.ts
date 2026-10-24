import WebpayPaymentProviderService from "../service"

describe("Webpay provider options", () => {
  test("allows integration mode with localhost return URL", () => {
    expect(() =>
      WebpayPaymentProviderService.validateOptions({
        environment: "integration",
        return_url: "http://localhost:9000/webpay/return",
      })
    ).not.toThrow()
  })

  test("production requires commerce code and API key", () => {
    expect(() =>
      WebpayPaymentProviderService.validateOptions({
        environment: "production",
        return_url: "https://neni.cl/webpay/return",
      })
    ).toThrow()
  })

  test("production rejects an HTTP return URL", () => {
    expect(() =>
      WebpayPaymentProviderService.validateOptions({
        environment: "production",
        commerce_code: "597055555532",
        api_key: "secret-not-real",
        return_url: "http://neni.cl/webpay/return",
      })
    ).toThrow()
  })

  test("production accepts credentials with HTTPS return URL", () => {
    expect(() =>
      WebpayPaymentProviderService.validateOptions({
        environment: "production",
        commerce_code: "597055555532",
        api_key: "secret-not-real",
        return_url: "https://neni.cl/webpay/return",
      })
    ).not.toThrow()
  })
})
