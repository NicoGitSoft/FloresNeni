import type { ExecArgs } from "@medusajs/framework/types"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"

import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"


type ProductoNeni = {
  handle: string
  sku: string
  name: string
  price: number
  composition: string
  description: string
  images: string[]
  variable?: boolean
}


const productos: ProductoNeni[] = [

  {
    handle: "petit-mirasol",
    sku: "NENI-PETIT-MIRASOL",
    name: "Petit Mirasol",
    price: 16000,

    composition:
      "5 girasoles + follaje",

    description:
      "Cinco girasoles acompañados de follaje seleccionado y envueltos en papel. Un diseño pequeño, luminoso y directo.",

    images: [
      "/images/products/petit-mirasol.jpeg",
    ],
  },


  {
    handle: "rosas-5",
    sku: "NENI-ROSAS-5",
    name: "Rosas de Cinco",
    price: 16500,

    composition:
      "5 rosas + follaje",

    description:
      "Cinco rosas acompañadas de follaje y terminadas con envoltorio Neni.",

    images: [
      "/images/products/rosas-5.jpeg",
    ],
  },


  {
    handle: "rosas-eucalipto",
    sku: "NENI-ROSAS-EUCALIPTO",
    name: "Rosas & Eucalipto",
    price: 18000,

    composition:
      "5 rosas + eucalipto",

    description:
      "Una composición clásica de rosas acompañada por eucalipto, que aporta textura, movimiento y un acabado natural.",

    images: [
      "/images/products/rosas-eucalipto.jpeg",
    ],
  },


  {
    handle: "triada-amarilla",
    sku: "NENI-TRIADA-AMARILLA",
    name: "Tríada Amarilla",
    price: 19000,

    composition:
      "3 girasoles · 2 rosas amarillas · 1 mini rosa · follaje",

    description:
      "Una composición en tonos amarillos construida con tres girasoles, rosas y mini rosa, acompañada de follaje.",

    images: [
      "/images/products/triada-amarilla.jpeg",
    ],
  },


  {
    handle: "mix-del-dia",
    sku: "NENI-MIX-DIA",
    name: "Mix del Día",
    price: 25000,

    composition:
      "10 varas + follaje variado",

    description:
      "Una selección de diez varas escogidas entre las flores disponibles durante el día. Cada Mix del Día es diferente y refleja la selección fresca del taller.",

    images: [
      "/images/products/mix-del-dia.jpeg",
    ],

    variable: true,
  },


  {
    handle: "romantico-12",
    sku: "NENI-ROMANTICO-12",
    name: "Romántico de 12",
    price: 26000,

    composition:
      "12 rosas rojas",

    description:
      "Doce rosas rojas reunidas en un ramo clásico y expresivo.",

    images: [
      "/images/products/romantico-12.jpeg",
    ],
  },


  {
    handle: "tulipanes-amanecer",
    sku: "NENI-TULIPANES-AMANECER",
    name: "Tulipanes Amanecer",
    price: 26000,

    composition:
      "10 tulipanes de un color",

    description:
      "Diez varas de tulipanes seleccionadas en una sola tonalidad. Trabajamos principalmente colores frescos y cítricos según disponibilidad.",

    images: [
      "/images/products/tulipanes-amanecer.jpeg",
    ],
  },


  {
    handle: "mirasol",
    sku: "NENI-MIRASOL",
    name: "Mirasol",
    price: 29000,

    composition:
      "10 girasoles",

    description:
      "Diez girasoles protagonistas. El color y estilo del papel pueden variar, manteniendo siempre la identidad del diseño.",

    images: [
      "/images/products/mirasol-1.jpeg",
      "/images/products/mirasol-2.jpeg",
    ],

    variable: true,
  },


  {
    handle: "clasico-especial",
    sku: "NENI-CLASICO-ESPECIAL",
    name: "Clásico Especial",
    price: 30000,

    composition:
      "5 girasoles · 5 rosas rosadas",

    description:
      "Cinco girasoles y cinco rosas rosadas, sin follaje, creando una composición limpia donde las flores son las protagonistas.",

    images: [
      "/images/products/clasico-especial.jpeg",
    ],
  },


  {
    handle: "berries",
    sku: "NENI-BERRIES",
    name: "Berries",
    price: 35000,

    composition:
      "18 varas",

    description:
      "Una composición intensa de 18 varas que combina rosas rojas, eryngium, mini rosas fucsias y ranúnculos en tonos morados.",

    images: [
      "/images/products/berries.jpeg",
    ],
  },


  {
    handle: "jardin-de-flores",
    sku: "NENI-JARDIN-FLORES",
    name: "Jardín de Flores",
    price: 44000,

    composition:
      "20 varas + follaje",

    description:
      "Nuestro jardín más abundante: veinte varas seleccionadas según las mejores flores disponibles del día, acompañadas por follaje como eucalipto, ruscus o tuya.",

    images: [
      "/images/products/jardin-flores-1.jpeg",
      "/images/products/jardin-flores-2.jpeg",
    ],

    variable: true,
  },

]


async function writeStorefrontPublishableKey(newToken?: string) {
  const envPath = resolve(process.cwd(), "../storefront/.env")
  let envContents = ""

  try {
    envContents = await readFile(envPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }

  const currentToken = envContents.match(/^PUBLIC_MEDUSA_PUBLISHABLE_KEY=(.*)$/m)?.[1]
  const token =
    newToken ?? (currentToken || process.env.NENI_STORE_PUBLISHABLE_KEY)

  if (!token?.startsWith("pk_")) {
    throw new Error(
      "La publishable API key ya existe, pero no se puede recuperar en claro. " +
        "Restaura apps/storefront/.env o revoca esa key desde Admin antes de crear otra."
    )
  }

  const keyLine = `PUBLIC_MEDUSA_PUBLISHABLE_KEY=${token}`
  envContents = /^PUBLIC_MEDUSA_PUBLISHABLE_KEY=.*$/m.test(envContents)
    ? envContents.replace(/^PUBLIC_MEDUSA_PUBLISHABLE_KEY=.*$/m, keyLine)
    : `${envContents.trimEnd()}${envContents.trim() ? "\n" : ""}${keyLine}\n`

  await writeFile(envPath, envContents, { mode: 0o600 })
  await chmod(envPath, 0o600)
}


export default async function seedCatalogoNeni({
  container,
}: ExecArgs) {

  const logger =
    container.resolve(
      ContainerRegistrationKeys.LOGGER
    )

  const productService =
    container.resolve(
      Modules.PRODUCT
    )

  const salesChannelService =
    container.resolve(
      Modules.SALES_CHANNEL
    )

  const fulfillmentService =
    container.resolve(
      Modules.FULFILLMENT
    )

  const stockLocationService =
    container.resolve(
      Modules.STOCK_LOCATION
    )

  const apiKeyService =
    container.resolve(
      Modules.API_KEY
    )

  const link =
    container.resolve(
      ContainerRegistrationKeys.LINK
    )

  const query =
    container.resolve(
      ContainerRegistrationKeys.QUERY
    )

  const hasRelation = async (
    entity: string,
    id: string,
    relation: string,
    relatedId: string
  ) => {
    const { data } = await query.graph({
      entity,
      fields: ["id", `${relation}.id`],
      filters: { id },
    })
    const relatedRecords = data[0]?.[relation] as { id: string }[] | undefined
    return relatedRecords?.some((record) => record.id === relatedId) ?? false
  }


  logger.info("Preparando recursos de desarrollo Neni...")

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })

  const existingChileRegion = existingRegions.find(
    (candidate) => candidate.name === "Chile"
  )

  if (
    existingChileRegion &&
    (existingChileRegion.currency_code !== "clp" ||
      !existingChileRegion.countries?.some((country) => country?.iso_2 === "cl"))
  ) {
    throw new Error(
      'Ya existe una región "Chile" incompatible. Corrígela manualmente; el bootstrap no duplicará regiones.'
    )
  }

  let region: { id: string; name: string; currency_code: string } | undefined =
    existingChileRegion

  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Chile",
            currency_code: "clp",
            countries: ["cl"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = {
      id: result[0].id,
      name: result[0].name,
      currency_code: result[0].currency_code,
    }
  }

  const salesChannels =
    await salesChannelService.listSalesChannels({
      name: "Neni Web",
    })

  let salesChannel = salesChannels[0]

  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Neni Web",
            description: "Canal de ventas de la tienda Neni.",
          },
        ],
      },
    })
    salesChannel = result[0]
  }

  const stockLocations =
    await stockLocationService.listStockLocations({
      name: "Taller Neni",
    })

  let stockLocation = stockLocations[0]

  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Taller Neni",
            address: {
              city: "Santiago",
              country_code: "CL",
              address_1: "",
            },
          },
        ],
      },
    })
    stockLocation = result[0]
  }

  if (
    !(await hasRelation(
      "stock_location",
      stockLocation.id,
      "sales_channels",
      salesChannel.id
    ))
  ) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [salesChannel.id],
      },
    })
  }

  const { data: existingFulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name"],
    filters: { name: "Taller Neni" },
  })

  let fulfillmentSet: { id: string } | undefined = existingFulfillmentSets[0]

  if (!fulfillmentSet) {
    const createdFulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: "Taller Neni",
      type: "shipping",
      service_zones: [
        {
          name: "Chile",
          geo_zones: [
            {
              country_code: "cl",
              type: "country",
            },
          ],
        },
      ],
    })
    fulfillmentSet = { id: createdFulfillmentSet.id }
  }

  if (
    !(await hasRelation(
      "stock_location",
      stockLocation.id,
      "fulfillment_sets",
      fulfillmentSet.id
    ))
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
  }

  if (
    !(await hasRelation(
      "stock_location",
      stockLocation.id,
      "fulfillment_providers",
      "manual_manual"
    ))
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    })
  }

  const apiKeys =
    await apiKeyService.listApiKeys({
      title: "Neni Web Storefront",
      type: "publishable",
    })

  let apiKey = apiKeys[0]

  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Neni Web Storefront",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    })
    apiKey = result[0]
  }

  if (
    !(await hasRelation(
      "api_key",
      apiKey.id,
      "sales_channels",
      salesChannel.id
    ))
  ) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: apiKey.id,
        add: [salesChannel.id],
      },
    })
  }

  await writeStorefrontPublishableKey(
    apiKey.token?.startsWith("pk_") ? apiKey.token : undefined
  )

  const shippingProfiles =
    await fulfillmentService.listShippingProfiles({
      type: "default",
    })

  const shippingProfile = shippingProfiles[0]

  if (!shippingProfile) {
    throw new Error("No existe Shipping Profile default.")
  }

  const { data: [fulfillmentSetData] } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "service_zones.id"],
    filters: { id: fulfillmentSet.id },
  })

  const serviceZone = fulfillmentSetData?.service_zones?.[0]

  if (!serviceZone) {
    throw new Error("El fulfillment set Neni no tiene una zona de servicio.")
  }

  const shippingOptions =
    await fulfillmentService.listShippingOptions({
      name: "Despacho Neni (desarrollo)",
    })

  if (!shippingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Despacho Neni (desarrollo)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Opción de fulfillment manual para desarrollo.",
            code: "standard",
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
  }

  logger.info(`Región: ${region.name} (${region.currency_code.toUpperCase()})`)
  logger.info(`Sales Channel: ${salesChannel.name}`)
  logger.info(`Stock Location: ${stockLocation.name}`)
  logger.info(`Publishable API Key: ${apiKey.title}`)

  /*
   * PRODUCTS
   */

  for (const producto of productos) {

    const existentes =
      await productService.listProducts({
        handle: producto.handle,
      })


    if (existentes.length) {

      logger.info(
        `⏭ ${producto.name}: ya existe`
      )

      const existingProduct = existentes[0]
      if (
        !(await hasRelation(
          "product",
          existingProduct.id,
          "sales_channels",
          salesChannel.id
        ))
      ) {
        await link.create({
          [Modules.PRODUCT]: {
            product_id: existingProduct.id,
          },
          [Modules.SALES_CHANNEL]: {
            sales_channel_id: salesChannel.id,
          },
        })
      }

      continue
    }


    logger.info(
      `🌸 Creando ${producto.name}`
    )


    await createProductsWorkflow(
      container
    ).run({

      input: {

        products: [

          {
            title:
              producto.name,

            handle:
              producto.handle,

            description:
              producto.description,

            status:
              ProductStatus.PUBLISHED,

            shipping_profile_id:
              shippingProfile.id,


            /*
             * La media todavía vive en el
             * storefront.
             *
             * Guardamos sus rutas para
             * migrarlas posteriormente a
             * object storage.
             */

            metadata: {

              composition:
                producto.composition,

              variable_design:
                producto.variable ?? false,

              image_1:
                producto.images[0] ?? "",

              image_2:
                producto.images[1] ?? "",
            },


            options: [

              {
                title:
                  "Formato",

                values: [
                  "Único",
                ],
              },

            ],


            variants: [

              {
                title:
                  "Único",

                sku:
                  producto.sku,


                /*
                 * Temporal:
                 *
                 * primero validaremos catálogo
                 * + carrito.
                 *
                 * Después activaremos inventario
                 * real por Stock Location.
                 */

                manage_inventory:
                  false,


                options: {
                  Formato:
                    "Único",
                },


                prices: [

                  {
                    amount:
                      producto.price,

                    currency_code:
                      "clp",
                  },

                ],

              },

            ],


            sales_channels: [

              {
                id:
                  salesChannel.id,
              },

            ],

          },

        ],

      },

    })


    logger.info(
      `✅ ${producto.name}`
    )
  }


  logger.info("")
  logger.info(
    "🌸 Catálogo Neni finalizado."
  )
}