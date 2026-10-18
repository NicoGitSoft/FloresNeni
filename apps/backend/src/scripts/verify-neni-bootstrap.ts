import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"

const expectedProductHandles = [
  "petit-mirasol",
  "rosas-5",
  "rosas-eucalipto",
  "triada-amarilla",
  "mix-del-dia",
  "romantico-12",
  "tulipanes-amanecer",
  "mirasol",
  "clasico-especial",
  "berries",
  "jardin-de-flores",
]

export default async function verifyNeniBootstrap({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const apiKeyService = container.resolve(Modules.API_KEY)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const productMatches = await Promise.all(
    expectedProductHandles.map((handle) =>
      productService.listProducts({
        handle,
        status: ProductStatus.PUBLISHED,
      })
    )
  )
  const [, publishedProductCount] = await productService.listAndCountProducts({
    status: ProductStatus.PUBLISHED,
  })
  const activeProductCount = productMatches.reduce(
    (count, matches) => count + matches.length,
    0
  )
  const duplicateProductHandles = productMatches.filter(
    (matches) => matches.length !== 1
  ).length

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  const chileRegions = regions.filter((region) => region.name === "Chile")
  const validChileRegions = chileRegions.filter(
    (region) =>
      region.currency_code === "clp" &&
      region.countries?.some((country) => country?.iso_2 === "cl")
  )

  const salesChannels = await salesChannelService.listSalesChannels({
    name: "Neni Web",
  })
  const stockLocations = await stockLocationService.listStockLocations({
    name: "Taller Neni",
  })
  const publishableApiKeys = await apiKeyService.listApiKeys({
    title: "Neni Web Storefront",
    type: "publishable",
  })

  const counts = [
    ["Productos Neni activos", activeProductCount, 11],
    ["Productos publicados totales", publishedProductCount, 11],
    ["Regiones Chile", chileRegions.length, 1],
    ["Regiones Chile CLP con país CL", validChileRegions.length, 1],
    ["Sales Channel Neni Web", salesChannels.length, 1],
    ["Stock Location Taller Neni", stockLocations.length, 1],
    ["Publishable API Key Neni Web Storefront", publishableApiKeys.length, 1],
    ["Handles de producto duplicados o ausentes", duplicateProductHandles, 0],
  ] as const

  for (const [label, actual, expected] of counts) {
    logger.info(`[Bootstrap smoke] ${label}: ${actual} (esperado: ${expected})`)
  }

  const mismatches = counts.filter(([, actual, expected]) => actual !== expected)
  if (mismatches.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La verificación de bootstrap Neni encontró conteos inesperados."
    )
  }

  logger.info("[Bootstrap smoke] Sin duplicados; conteos exactos verificados.")
}