import { materialBuildableQuantity } from "../material-buildable-quantity"

const component = (
  inventory_item_id: string,
  required_quantity: number,
  available_quantity: number,
  unit = "stem"
) => ({ inventory_item_id, required_quantity, available_quantity, unit })

describe("materialBuildableQuantity", () => {
  it("returns null when a recipe has no components", () => {
    expect(materialBuildableQuantity([])).toBeNull()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid required quantity %s",
    (required_quantity) => {
      expect(() =>
        materialBuildableQuantity([component("iitem_rose", required_quantity, 10)])
      ).toThrow("required_quantity")
    }
  )

  it("calculates a single component", () => {
    expect(materialBuildableQuantity([component("iitem_rose", 2, 10)])).toBe(5)
  })

  it("calculates across multiple components", () => {
    expect(
      materialBuildableQuantity([
        component("iitem_rose", 2, 10),
        component("iitem_paper", 1, 8, "sheet"),
      ])
    ).toBe(5)
  })

  it("uses the limiting component", () => {
    expect(
      materialBuildableQuantity([
        component("iitem_rose", 2, 10),
        component("iitem_foliage", 3, 9),
      ])
    ).toBe(3)
  })

  it("returns zero for zero stock", () => {
    expect(materialBuildableQuantity([component("iitem_rose", 1, 0)])).toBe(0)
  })

  it("returns zero when available stock is below one required quantity", () => {
    expect(materialBuildableQuantity([component("iitem_rose", 3, 2)])).toBe(0)
  })

  it("floors fractional buildable quantities", () => {
    expect(materialBuildableQuantity([component("iitem_rose", 4, 11)])).toBe(2)
  })

  it("does not mix components between separate recipes", () => {
    const firstRecipe = [component("iitem_rose", 2, 10)]
    const secondRecipe = [component("iitem_paper", 1, 0, "sheet")]

    expect(materialBuildableQuantity(firstRecipe)).toBe(5)
    expect(materialBuildableQuantity(secondRecipe)).toBe(0)
  })

  it("requires a valid inventory item identifier and unit", () => {
    expect(() => materialBuildableQuantity([component("", 1, 1)])).toThrow(
      "inventory item"
    )
    expect(() => materialBuildableQuantity([component("iitem_rose", 1, 1, " ")])).toThrow(
      "declare its unit"
    )
  })

  it("rejects duplicate inventory item references", () => {
    expect(() =>
      materialBuildableQuantity([
        component("iitem_rose", 1, 10),
        component("iitem_rose", 2, 10),
      ])
    ).toThrow("duplicate inventory item")
  })
})