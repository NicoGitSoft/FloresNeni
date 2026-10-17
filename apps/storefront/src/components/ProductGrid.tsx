import {
  useEffect,
  useState,
} from "react"

import {
  formatCLP,
  getProductImage,
  getProductPrice,
  getProductVariantId,
  getProducts,
  type MedusaProduct,
} from "../lib/medusa"

import {
  useCart,
} from "./CartContext"

export default function ProductGrid() {
  const [
    products,
    setProducts,
  ] =
    useState<MedusaProduct[]>([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)

  const {
    addItem,
    busy,
  } =
    useCart()

  useEffect(() => {
    async function loadProducts() {
      try {
        const result =
          await getProducts()

        setProducts(result)

      } catch (err) {
        console.error(err)

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar el catálogo."
        )

      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  if (loading) {
    return (
      <p>
        Cargando flores...
      </p>
    )
  }

  if (error) {
    return (
      <p>
        No pudimos cargar el catálogo.
      </p>
    )
  }

  return (
    <div className="products-grid">

      {products.map(
        product => {

          const image =
            getProductImage(
              product
            )

          const price =
            getProductPrice(
              product
            )

          const variantId =
            getProductVariantId(
              product
            )

          return (
            <article
              className="product-card"
              key={product.id}
              data-product-handle={
                product.handle
              }
            >

              {image && (
                <img
                  src={image}
                  alt={product.title}
                  loading="lazy"
                />
              )}

              <div className="product-card__content">

                <h3>
                  {product.title}
                </h3>

                {
                  product
                    .metadata
                    ?.composition &&
                  (
                    <p className="composition">

                      {
                        product
                          .metadata
                          .composition
                      }

                    </p>
                  )
                }

                {
                  product.description &&
                  (
                    <p>
                      {
                        product
                          .description
                      }
                    </p>
                  )
                }

                <strong>
                  {
                    formatCLP(
                      price
                    )
                  }
                </strong>

                <button
                  type="button"
                  disabled={
                    !variantId ||
                    busy
                  }
                  onClick={() => {
                    if (
                      variantId
                    ) {
                      void addItem(
                        variantId,
                        1
                      )
                    }
                  }}
                >
                  {
                    busy
                      ? "Actualizando..."
                      : "Agregar al carrito"
                  }
                </button>

              </div>

            </article>
          )
        }
      )}

    </div>
  )
}