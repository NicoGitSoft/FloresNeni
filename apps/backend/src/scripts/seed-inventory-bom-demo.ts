import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createProductVariantsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const fixtureId = "inventory-bom-v1"
const demoProductHandle = "demo-neni-material-kit"
const demoVariantSku = "NENI-DEMO-MATERIAL-KIT"

const materials = [
  {
    sku: "NENI-DEMO-FLOWER-ROSE",
    title: "DEMO - Flor de prueba",
    category: "flower",
    unit: "stem",
    required_quantity: 2,
    demo_stock: 10,
  },
  {
    sku: "NENI-DEMO-FOLIAGE-GREEN",
    title: "DEMO - Follaje de prueba",
    category: "foliage",
    unit: "stem",
    required_quantity: 1,
    demo_stock: 3,
  },
  {
    sku: "NENI-DEMO-WRAP-SHEET",
    title: "DEMO - Papel de prueba",
    category: "paper",
    unit: "sheet",
    required_quantity: 1,
    demo_stock: 5,
  },
  {
    sku: "NENI-DEMO-RIBBON",
    title: "DEMO - Cinta de prueba",
    category: "ribbon",
    unit: "meter",
    required_quantity: 1,
    demo_stock: 4,
  },
] as const

function isFixtureMaterial(metadata: Record<string, unknown> | null | undefined) {
  const material = metadata?.neni_material as
    | { fixture_id?: unknown }
    | undefined
  return material?.fixture_id === fixtureId
}

export default async function seedInventoryBomDemo({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY)
  const productService = container.resolve(Modules.PRODUCT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const stockLocations = await stockLocationService.listStockLocations({
    name: "Taller Neni",
  })
  if (stockLocations.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Se esperaba una sola ubicación Taller Neni; se encontraron ${stockLocations.length}.`
    )
  }
  const stockLocation = stockLocations[0]

  const existingBySku = new Map<
    string,
    Awaited<ReturnType<typeof inventoryService.retrieveInventoryItem>>
  >()
  const missingMaterials: typeof materials[number][] = []

  for (const material of materials) {
    const existing = await inventoryService.listInventoryItems(
      { sku: material.sku },
      { take: 2 }
    )
    if (existing.length > 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El SKU de fixture ${material.sku} está duplicado.`
      )
    }
    if (!existing.length) {
      missingMaterials.push(material)
      continue
    }

    const item = existing[0]
    if (!isFixtureMaterial(item.metadata)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El SKU ${material.sku} ya existe y no está marcado como material DEMO; no se modificó.`
      )
    }
    if (item.unit_of_measure !== material.unit) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El material DEMO ${material.sku} tiene una unidad distinta a la fixture.`
      )
    }
    if (item.material == null) {
      const updated = await inventoryService.updateInventoryItems({
        id: item.id,
        material: material.category,
      })
      existingBySku.set(material.sku, updated)
    } else if (item.material !== material.category) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El material DEMO ${material.sku} tiene una categoría distinta a la fixture.`
      )
    }
    if (item.material != null) {
      existingBySku.set(material.sku, item)
    }
  }

  if (missingMaterials.length) {
    const { result } = await createInventoryItemsWorkflow(container).run({
      input: {
        items: missingMaterials.map((material) => ({
          sku: material.sku,
          title: material.title,
          description: "Material sintético de desarrollo; no representa stock real de Neni.",
          material: material.category,
          unit_of_measure: material.unit,
          requires_shipping: false,
          metadata: {
            neni_material: {
              fixture_id: fixtureId,
              demo_only: true,
            },
          },
          location_levels: [
            {
              location_id: stockLocation.id,
              stocked_quantity: material.demo_stock,
            },
          ],
        })),
      },
    })

    for (const item of result) {
      if (item.sku) {
        existingBySku.set(item.sku, item)
      }
    }
  }

  for (const material of materials) {
    const item = existingBySku.get(material.sku)
    if (!item) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se pudo resolver el Inventory Item DEMO ${material.sku}.`
      )
    }

    const levels = await inventoryService.listInventoryLevels({
      inventory_item_id: item.id,
      location_id: stockLocation.id,
    })
    if (levels.length > 1) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `El material DEMO ${material.sku} tiene niveles duplicados en Taller Neni.`
      )
    }
    if (!levels.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: item.id,
              location_id: stockLocation.id,
              stocked_quantity: material.demo_stock,
            },
          ],
        },
      })
    }
  }

  const demoProducts = await productService.listProducts(
    { handle: demoProductHandle },
    { take: 2 }
  )
  if (demoProducts.length > 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El producto fixture DEMO está duplicado."
    )
  }

  let demoProduct = demoProducts[0]
  if (demoProduct && demoProduct.metadata?.neni_demo_fixture !== true) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `El handle ${demoProductHandle} ya existe y no está marcado como fixture DEMO.`
    )
  }

  if (!demoProduct) {
    const shippingProfiles = await fulfillmentService.listShippingProfiles({
      type: "default",
    })
    if (!shippingProfiles.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No existe Shipping Profile default para crear el producto fixture DEMO."
      )
    }

    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "DEMO - Kit de materiales Neni (no vendible)",
            handle: demoProductHandle,
            description: "Fixture técnico. No es un producto ni una receta comercial de Neni.",
            status: ProductStatus.DRAFT,
            shipping_profile_id: shippingProfiles[0].id,
            metadata: { neni_demo_fixture: true, fixture_id: fixtureId },
            options: [{ title: "Formato", values: ["DEMO"] }],
          },
        ],
      },
    })
    demoProduct = result[0]
  }

  const demoVariants = await productService.listProductVariants({
    product_id: demoProduct.id,
    sku: demoVariantSku,
  })
  if (demoVariants.length > 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La variante del fixture DEMO está duplicada."
    )
  }

  let demoVariant = demoVariants[0]
  if (!demoVariant) {
    const inventoryItems = materials.map((material) => {
      const item = existingBySku.get(material.sku)
      if (!item) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `No se pudo vincular ${material.sku} a la receta DEMO.`
        )
      }
      return {
        inventory_item_id: item.id,
        required_quantity: material.required_quantity,
      }
    })

    const { result } = await createProductVariantsWorkflow(container).run({
      input: {
        product_variants: [
          {
            product_id: demoProduct.id,
            title: "DEMO - Receta de prueba",
            sku: demoVariantSku,
            manage_inventory: true,
            inventory_items: inventoryItems,
            options: { Formato: "DEMO" },
            prices: [],
          },
        ],
      },
    })
    demoVariant = result[0]
  }

  if (!demoVariant.manage_inventory) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La variante fixture DEMO debe administrar inventario."
    )
  }

  const { data: existingLinks } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: ["variant_id", "inventory_item_id", "required_quantity"],
    filters: { variant_id: demoVariant.id },
  })

  const expectedInventoryItemIds = new Set(
    materials.flatMap((material) => {
      const item = existingBySku.get(material.sku)
      return item ? [item.id] : []
    })
  )
  if (existingLinks.some((item) => !expectedInventoryItemIds.has(item.inventory_item_id))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La variante fixture DEMO contiene materiales fuera de su composición declarada."
    )
  }

  for (const material of materials) {
    const item = existingBySku.get(material.sku)
    if (!item) {
      continue
    }
    const existingLink = existingLinks.find(
      (candidate) => candidate.inventory_item_id === item.id
    )
    if (existingLink) {
      if (existingLink.required_quantity !== material.required_quantity) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `La cantidad del componente DEMO ${material.sku} no coincide con la fixture.`
        )
      }
      continue
    }

    await link.create({
      [Modules.PRODUCT]: { variant_id: demoVariant.id },
      [Modules.INVENTORY]: { inventory_item_id: item.id },
      data: { required_quantity: material.required_quantity },
    })
  }

  logger.info(
    `[Inventory BOM] Fixture DEMO lista: ${materials.length} Inventory Items y variante ${demoVariant.sku}; niveles de prueba en Taller Neni.`
  )
}