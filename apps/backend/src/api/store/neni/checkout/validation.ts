import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

const deliveryAddressSchema = z
  .object({
    address_1: z.string().trim().min(1, "Ingresa la dirección.").max(255),
    address_2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1, "Ingresa la comuna.").max(100),
    province: z.string().trim().max(100).optional(),
    postal_code: z.string().trim().max(30).optional(),
  })
  .strict()

export const checkoutRequestSchema = z
  .object({
    cart_id: z.string().trim().min(1, "No se encontró el carrito."),
    first_name: z.string().trim().min(1, "Ingresa tu nombre.").max(100),
    last_name: z.string().trim().min(1, "Ingresa tu apellido.").max(100),
    email: z.string().trim().email("Ingresa un email válido.").max(254),
    phone: z
      .string()
      .trim()
      .min(8, "Ingresa un teléfono válido.")
      .max(24, "Ingresa un teléfono válido.")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 8,
        "Ingresa un teléfono válido."
      ),
    fulfillment_method: z.enum(["pickup", "delivery"]),
    requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida."),
    delivery_address: deliveryAddressSchema.optional(),
  })
  .strict()

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export function getChileCivilDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ""

  return `${part("year")}-${part("month")}-${part("day")}`
}

function isValidCivilDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export function validateCheckoutInput(
  input: unknown,
  options: { hasItems: boolean; today?: string }
): CheckoutRequest {
  const parsed = checkoutRequestSchema.safeParse(input)

  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Revisa los datos del checkout."
    )
  }

  if (!options.hasItems) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Agrega un producto al carrito antes de continuar."
    )
  }

  const checkout = parsed.data

  if (!isValidCivilDate(checkout.requested_date)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Elige una fecha válida."
    )
  }

  if (checkout.requested_date < (options.today ?? getChileCivilDate())) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La fecha solicitada no puede estar en el pasado."
    )
  }

  if (checkout.fulfillment_method === "delivery" && !checkout.delivery_address) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Completa la dirección para solicitar despacho."
    )
  }

  return {
    ...checkout,
    email: checkout.email.toLowerCase(),
  }
}