import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { CreateAddressDTO } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"

import {
  getChileCivilDate,
  validateCheckoutInput,
  type CheckoutRequest,
} from "./validation"

export async function POST(
  req: MedusaRequest<CheckoutRequest>,
  res: MedusaResponse
) {
  const cartService = req.scope.resolve(Modules.CART)
  const cart = await cartService.retrieveCart(req.validatedBody.cart_id, {
    relations: ["items"],
  })
  const checkout = validateCheckoutInput(req.validatedBody, {
    hasItems: Boolean(cart.items?.length),
    today: getChileCivilDate(),
  })

  if (!cart.region_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El carrito no tiene una región de Chile asociada."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "countries.iso_2"],
    filters: { id: cart.region_id },
  })

  if (!regions[0]?.countries?.some((country) => country?.iso_2 === "cl")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El carrito debe pertenecer a una región que admita Chile."
    )
  }

  let shippingAddress: CreateAddressDTO | null = null
  if (checkout.fulfillment_method === "delivery") {
    const address = checkout.delivery_address
    if (!address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Completa la dirección para solicitar despacho."
      )
    }

    shippingAddress = {
      first_name: checkout.first_name,
      last_name: checkout.last_name,
      address_1: address.address_1,
      address_2: address.address_2,
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      country_code: "cl",
      phone: checkout.phone,
    }
  }

  await updateCartWorkflow(req.scope).run({
    input: {
      id: cart.id,
      email: checkout.email,
      shipping_address: shippingAddress,
      metadata: {
        ...(cart.metadata ?? {}),
        neni_checkout: {
          fulfillment_method: checkout.fulfillment_method,
          requested_date: checkout.requested_date,
          first_name: checkout.first_name,
          last_name: checkout.last_name,
          phone: checkout.phone,
        },
      },
    },
  })

  const updatedCart = await cartService.retrieveCart(cart.id, {
    relations: ["items", "shipping_address"],
  })

  res.status(200).json({ cart: updatedCart })
}