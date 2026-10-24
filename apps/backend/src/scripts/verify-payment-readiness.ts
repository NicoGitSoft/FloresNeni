import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

const WEBPAY_PROVIDER_ID = "pp_webpay_webpay"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

export default async function verifyPaymentReadiness({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const payment = container.resolve(Modules.PAYMENT)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const providers = await payment.listPaymentProviders({})
  assert(
    providers.some((provider) => provider.id === WEBPAY_PROVIDER_ID),
    `Falta ${WEBPAY_PROVIDER_ID}.`
  )

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "payment_providers.id"],
    filters: { name: "Chile" },
  })
  assert(regions.length === 1, "Debe existir una región Chile.")
  assert(regions[0].currency_code === "clp", "Chile debe usar CLP.")
  assert(
    regions[0].payment_providers?.some(
      (provider) => provider?.id === WEBPAY_PROVIDER_ID
    ),
    "Webpay debe estar habilitado en Chile."
  )

  for (const name of [
    "Despacho Neni (desarrollo)",
    "Retiro Taller Neni (desarrollo)",
  ]) {
    const options = await fulfillment.listShippingOptions({ name })
    assert(options.length === 1, `Se esperaba una shipping option ${name}.`)
  }

  logger.info("[Payments smoke] Provider Webpay registrado: OK")
  logger.info("[Payments smoke] Webpay habilitado en Chile/CLP: OK")
  logger.info("[Payments smoke] Shipping despacho/retiro dev: OK")
}
