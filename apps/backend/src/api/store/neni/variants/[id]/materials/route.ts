import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

import { materialBuildableQuantity } from "../../../../../../utils/inventory/material-buildable-quantity"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const variantId = req.params.id
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const variants = await productService.listProductVariants(
    { id: variantId },
    { take: 1 }
  )
  if (!variants.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No existe la variante ${variantId}.`
    )
  }
  if (
    variants[0].sku !== "NENI-DEMO-MATERIAL-KIT" ||
    !variants[0].product_id
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "La consulta de materiales está disponible solo para el fixture DEMO."
    )
  }

  const demoProduct = await productService.retrieveProduct(variants[0].product_id)
  if (
    demoProduct.status !== "draft" ||
    demoProduct.metadata?.neni_demo_fixture !== true ||
    demoProduct.metadata?.fixture_id !== "inventory-bom-v1"
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "La consulta de materiales está disponible solo para el fixture DEMO."
    )
  }

  const { data: links } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: ["variant_id", "inventory_item_id", "required_quantity"],
    filters: { variant_id: variantId },
  })

  if (!links.length) {
    return res.json({
      product_variant_id: variantId,
      components: [],
      material_buildable_quantity: null,
    })
  }

  const stockLocations = await req.scope
    .resolve(Modules.STOCK_LOCATION)
    .listStockLocations({ name: "Taller Neni" })
  if (stockLocations.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "No se encontró una única ubicación Taller Neni para consultar materiales."
    )
  }

  const inventoryItemIds = links.map((link) => link.inventory_item_id)
  const inventoryItems = await inventoryService.listInventoryItems(
    { id: inventoryItemIds },
    { take: inventoryItemIds.length }
  )
  if (
    inventoryItems.length !== links.length ||
    inventoryItems.some(
      (item) =>
        !isDemoInventoryItem(item.metadata)
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "La receta solicitada no está disponible para consulta Store."
    )
  }

  const availableQuantities = await Promise.all(
    inventoryItems.map(async (item) => [
      item.id,
      (
        await inventoryService.retrieveAvailableQuantity(item.id, [
          stockLocations[0].id,
        ])
      ).numeric,
    ] as const)
  )
  const inventoryLevels = await inventoryService.listInventoryLevels(
    {
      inventory_item_id: inventoryItemIds,
      location_id: stockLocations[0].id,
    },
    { take: inventoryItemIds.length }
  )

  const itemsById = new Map(inventoryItems.map((item) => [item.id, item]))
  const availableByItemId = new Map(availableQuantities)
  const levelsByItemId = new Set(
    inventoryLevels.map((level) => level.inventory_item_id)
  )

  const components = links.map((link) => {
    const item = itemsById.get(link.inventory_item_id)
    if (!item) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se encontró el Inventory Item ${link.inventory_item_id} de la receta.`
      )
    }

    const materialMetadata = item.metadata?.neni_material as
      | { demo_only?: boolean }
      | undefined

    return {
      inventory_item_id: item.id,
      material: item.title ?? item.sku ?? "Material Neni",
      category: item.material ?? "other",
      demo_only: materialMetadata?.demo_only === true,
      quantity_required: link.required_quantity,
      unit: item.unit_of_measure ?? "unit",
      available_quantity: levelsByItemId.has(item.id)
        ? availableByItemId.get(item.id) ?? 0
        : 0,
    }
  })

  const materialBuildable = materialBuildableQuantity(
    components.map((component) => ({
      inventory_item_id: component.inventory_item_id,
      required_quantity: component.quantity_required,
      unit: component.unit,
      available_quantity: component.available_quantity,
    }))
  )

  res.json({
    product_variant_id: variantId,
    components,
    material_buildable_quantity: materialBuildable,
  })
}

function isDemoInventoryItem(metadata: Record<string, unknown> | null | undefined) {
  const fixture = metadata?.neni_material as
    | { fixture_id?: unknown; demo_only?: unknown }
    | undefined
  return fixture?.fixture_id === "inventory-bom-v1" && fixture.demo_only === true
}