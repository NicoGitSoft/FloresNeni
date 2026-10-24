import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

const WEBPAY_PROVIDER_ID = "pp_webpay_webpay"
const SYSTEM_PROVIDER_ID = "pp_system_default"

export default async function bootstrapPaymentProviders({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const payment = container.resolve(Modules.PAYMENT)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "payment_providers.id"],
    filters: { name: "Chile" },
  })

  if (regions.length !== 1 || regions[0].currency_code !== "clp") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Se esperaba exactamente una región Chile/CLP."
    )
  }

  const region = regions[0]
  const installedProviders = await payment.listPaymentProviders({})
  const providerIds = new Set(installedProviders.map((provider) => provider.id))

  if (!providerIds.has(WEBPAY_PROVIDER_ID)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `El provider ${WEBPAY_PROVIDER_ID} no está registrado. Revisa medusa-config.ts.`
    )
  }

  const current = new Set(
    (region.payment_providers ?? [])
      .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
      .map((provider) => provider.id)
  )

  for (const providerId of [SYSTEM_PROVIDER_ID, WEBPAY_PROVIDER_ID]) {
    if (providerIds.has(providerId) && !current.has(providerId)) {
      await link.create({
        [Modules.REGION]: { region_id: region.id },
        [Modules.PAYMENT]: { payment_provider_id: providerId },
      })
      logger.info(`[Payments] Provider ${providerId} vinculado a Chile.`)
    }
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "fulfillment_sets.id", "fulfillment_sets.service_zones.id"],
    filters: { name: "Taller Neni" },
  })

  if (locations.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Se esperaba exactamente un Stock Location Taller Neni."
    )
  }

  const serviceZoneId =
    locations[0].fulfillment_sets?.[0]?.service_zones?.[0]?.id

  if (!serviceZoneId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Taller Neni no tiene service zone."
    )
  }

  const shippingProfiles = await fulfillment.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "No existe Shipping Profile default."
    )
  }

  const definitions = [
    {
      name: "Despacho Neni (desarrollo)",
      label: "Despacho",
      code: "neni-delivery-dev",
    },
    {
      name: "Retiro Taller Neni (desarrollo)",
      label: "Retiro",
      code: "neni-pickup-dev",
    },
  ]

  for (const definition of definitions) {
    const existing = await fulfillment.listShippingOptions({
      name: definition.name,
    })

    if (existing.length > 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Shipping option duplicada: ${definition.name}.`
      )
    }

    if (!existing.length) {
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: definition.name,
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId,
            shipping_profile_id: shippingProfile.id,
            type: {
              label: definition.label,
              description: "Opción temporal para pruebas e-commerce Neni.",
              code: definition.code,
            },
            prices: [
              {
                region_id: region.id,
                amount: 0,
              },
            ],
            rules: [
              {
                attribute: "enabled_in_store",
                value: "true",
                operator: "eq",
              },
              {
                attribute: "is_return",
                value: "false",
                operator: "eq",
              },
            ],
          },
        ],
      })
      logger.info(`[Payments] Shipping option creada: ${definition.name}.`)
    }
  }

  logger.info("[Payments] Bootstrap de pagos listo.")
}
