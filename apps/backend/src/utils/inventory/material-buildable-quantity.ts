import { MedusaError } from "@medusajs/framework/utils"

export type MaterialRequirement = {
  inventory_item_id: string
  required_quantity: number
  unit: string
  available_quantity: number
}

export function materialBuildableQuantity(
  components: readonly MaterialRequirement[]
): number | null {
  if (components.length === 0) {
    return null
  }

  const inventoryItemIds = new Set<string>()
  let buildableQuantity = Number.POSITIVE_INFINITY

  for (const component of components) {
    if (!component.inventory_item_id.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A recipe component must reference an inventory item."
      )
    }
    if (inventoryItemIds.has(component.inventory_item_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A recipe cannot contain a duplicate inventory item."
      )
    }
    if (!component.unit.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A recipe component must declare its unit."
      )
    }
    if (
      !Number.isFinite(component.required_quantity) ||
      component.required_quantity <= 0
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "required_quantity must be a positive finite number."
      )
    }
    if (
      !Number.isFinite(component.available_quantity) ||
      component.available_quantity < 0
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "available_quantity must be a non-negative finite number."
      )
    }

    inventoryItemIds.add(component.inventory_item_id)
    buildableQuantity = Math.min(
      buildableQuantity,
      Math.floor(component.available_quantity / component.required_quantity)
    )
  }

  return buildableQuantity
}