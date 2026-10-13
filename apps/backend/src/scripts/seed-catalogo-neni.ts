import type { ExecArgs } from "@medusajs/framework/types"

import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"

import {
  createProductsWorkflow,
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


  /*
   * SALES CHANNEL
   */

  let salesChannels =
    await salesChannelService.listSalesChannels({
      name: "Neni Web",
    })


  /*
   * Durante esta primera fase permitimos
   * utilizar el canal default.
   */

  if (!salesChannels.length) {

    logger.warn(
      'No existe "Neni Web". Usando el primer Sales Channel disponible.'
    )

    salesChannels =
      await salesChannelService.listSalesChannels()
  }


  const salesChannel =
    salesChannels[0]


  if (!salesChannel) {

    throw new Error(
      "No existe ningún Sales Channel."
    )
  }


  /*
   * SHIPPING PROFILE
   */

  const shippingProfiles =
    await fulfillmentService.listShippingProfiles({
      type: "default",
    })


  const shippingProfile =
    shippingProfiles[0]


  if (!shippingProfile) {

    throw new Error(
      "No existe Shipping Profile default."
    )
  }


  logger.info(
    `Sales Channel: ${salesChannel.name}`
  )

  logger.info(
    `Shipping Profile: ${shippingProfile.name}`
  )


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