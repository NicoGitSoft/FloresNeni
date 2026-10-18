import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"

import {
  materialBuildableQuantity,
  type MaterialRequirement,
} from "../utils/inventory/material-buildable-quantity"

const fixtureId = "inventory-bom-v1"
const productHandle = "demo-neni-material-kit"
const variantSku = "NENI-DEMO-MATERIAL-KIT"

const expectedMaterials = [
  {
    sku: "NENI-DEMO-FLOWER-ROSE",
    unit: "stem",
    category: "flower",
    required_quantity: 2,
    stocked_quantity: 10,
  },
  {
    sku: "NENI-DEMO-FOLIAGE-GREEN",
    unit: "stem",
    category: "foliage",
    required_quantity: 1,
    stocked_quantity: 3,
  },
  {
    sku: "NENI-DEMO-WRAP-SHEET",
    unit: "sheet",
    category: "paper",
    required_quantity: 1,
    stocked_quantity: 5,
  },
  {
    sku: "NENI-DEMO-RIBBON",
    unit: "meter",
    category: "ribbon",
    required_quantity: 1,
    stocked_quantity: 4,
  },
] as const

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

export default async function verifyInventoryBomDemo({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY)
  const productService = container.resolve(Modules.PRODUCT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const expectedMode = process.env.NENI_INVENTORY_DEMO_EXPECT ?? "present"

  assert(
    expectedMode === "absent" || expectedMode === "present",
    "NENI_INVENTORY_DEMO_EXPECT must be absent or present."
  )

  const itemsBySku = new Map<string, Awaited<
    ReturnType<typeof inventoryService.retrieveInventoryItem>
  >>()
  for (const material of expectedMaterials) {
    const items = await inventoryService.listInventoryItems(
      { sku: material.sku },
      { take: 2 }
    )
    assert(items.length <= 1, `Duplicate DEMO inventory item SKU: ${material.sku}.`)
    if (items[0]) {
      itemsBySku.set(material.sku, items[0])
    }
  }

  const demoProducts = await productService.listProducts(
    { handle: productHandle },
    { take: 2 }
  )
  const demoVariants = await productService.listProductVariants(
    { sku: variantSku },
    { take: 2 }
  )

  if (expectedMode === "absent") {
    assert(itemsBySku.size === 0, "Normal bootstrap created DEMO inventory items.")
    assert(demoProducts.length === 0, "Normal bootstrap created the DEMO product.")
    assert(demoVariants.length === 0, "Normal bootstrap created the DEMO variant.")
    logger.info("[Inventory BOM smoke] DEMO fixtures absent after normal bootstrap.")
    return
  }

  assert(itemsBySku.size === expectedMaterials.length, "Missing expected DEMO inventory items.")
  assert(demoProducts.length === 1, "Expected exactly one DEMO fixture product.")
  assert(demoVariants.length === 1, "Expected exactly one DEMO fixture variant.")

  const demoProduct = demoProducts[0]
  const demoVariant = demoVariants[0]
  assert(
    demoVariant.product_id === demoProduct.id,
    "The DEMO kit variant must belong to the stable fixture product."
  )
  assert(
    demoProduct.status === ProductStatus.DRAFT &&
      demoProduct.metadata?.neni_demo_fixture === true &&
      demoProduct.metadata?.fixture_id === fixtureId,
    "The DEMO fixture product must remain draft and explicitly marked."
  )
  assert(demoVariant.manage_inventory, "The DEMO fixture variant must manage inventory.")

  const stockLocations = await stockLocationService.listStockLocations({
    name: "Taller Neni",
  })
  assert(stockLocations.length === 1, "Expected exactly one Taller Neni stock location.")
  const stockLocationId = stockLocations[0].id

  const { data: links } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: ["variant_id", "inventory_item_id", "required_quantity"],
    filters: { variant_id: demoVariant.id },
  })
  assert(links.length === expectedMaterials.length, "Unexpected DEMO component link count.")

  const components: MaterialRequirement[] = []
  for (const expected of expectedMaterials) {
    const item = itemsBySku.get(expected.sku)
    assert(item, `Missing DEMO inventory item: ${expected.sku}.`)
    const metadata = item.metadata?.neni_material as
      | { fixture_id?: unknown; demo_only?: unknown }
      | undefined
    assert(
      metadata?.fixture_id === fixtureId && metadata.demo_only === true,
      `Inventory item ${expected.sku} is not explicitly marked demo_only.`
    )
    assert(item.material === expected.category, `Unexpected category for ${expected.sku}.`)
    assert(item.unit_of_measure === expected.unit, `Unexpected unit for ${expected.sku}.`)

    const levels = await inventoryService.listInventoryLevels(
      { inventory_item_id: item.id, location_id: stockLocationId },
      { take: 2 }
    )
    assert(levels.length === 1, `Expected exactly one Taller Neni level for ${expected.sku}.`)
    assert(
      Number(levels[0].stocked_quantity) === expected.stocked_quantity,
      `Unexpected DEMO stock for ${expected.sku}.`
    )

    const itemLinks = links.filter((link) => link.inventory_item_id === item.id)
    assert(itemLinks.length === 1, `Expected exactly one BOM link for ${expected.sku}.`)
    assert(
      Number(itemLinks[0].required_quantity) === expected.required_quantity,
      `Unexpected required_quantity for ${expected.sku}.`
    )

    const available = await inventoryService.retrieveAvailableQuantity(item.id, [
      stockLocationId,
    ])
    components.push({
      inventory_item_id: item.id,
      required_quantity: expected.required_quantity,
      unit: expected.unit,
      available_quantity: available.numeric,
    })
  }

  assert(
    links.every((link) => [...itemsBySku.values()].some((item) => item.id === link.inventory_item_id)),
    "The DEMO kit contains a component outside the expected fixture SKUs."
  )

  const buildableQuantity = materialBuildableQuantity(components)
  assert(buildableQuantity === 3, `Expected DEMO material_buildable_quantity 3, got ${buildableQuantity}.`)

  const { data: pricing } = await query.graph({
    entity: "product_variant",
    fields: ["id", "price_set.prices.id"],
    filters: { id: demoVariant.id },
  })
  assert(
    !pricing[0]?.price_set?.prices?.length,
    "The DEMO fixture variant must not have a sales price."
  )

  logger.info("[Inventory BOM smoke] Inventory Items DEMO: 4 (esperado: 4)")
  logger.info(
    `[Inventory BOM smoke] Stable fixture SKUs: ${expectedMaterials.map((item) => item.sku).join(", ")}`
  )
  logger.info(
    `[Inventory BOM smoke] Stable fixture IDs: ${expectedMaterials
      .map((item) => `${item.sku}=${itemsBySku.get(item.sku)?.id}`)
      .join(", ")}`
  )
  logger.info(
    `[Inventory BOM smoke] Stable kit IDs: product=${demoProduct.id}, variant=${demoVariant.id}`
  )
  logger.info("[Inventory BOM smoke] Levels DEMO en Taller Neni: 4 (esperado: 4)")
  logger.info("[Inventory BOM smoke] Links DEMO exactos: 4 (esperado: 4)")
  logger.info(`[Inventory BOM smoke] material_buildable_quantity: ${buildableQuantity} (esperado: 3)`)
  logger.info("[Inventory BOM smoke] Sin duplicados; fixture DEMO verificada.")
}
