import { useEffect, useRef, useState, type CSSProperties } from "react"
import { toneFromImage, type FloralTone } from "../lib/floralPalette"
import {
  formatCLP, getProductImage, getProductPrice, getProductVariantId,
  getProducts, type MedusaProduct,
} from "../lib/medusa"
import { useCart } from "./CartContext"

export default function ProductGrid() {
  const [products, setProducts] = useState<MedusaProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MedusaProduct | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [tones, setTones] = useState<Record<string, FloralTone>>({})
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const { addItem, busy, error: cartError } = useCart()

  useEffect(() => {
    let active = true
    getProducts().then(result => {
      if (active) {
        setProducts(result)
        setError(null)
      }
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "No fue posible cargar el catálogo.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const syncToUrl = () => {
      const handle = new URL(window.location.href).searchParams.get("producto")
      setSelected(products.find(item => item.handle === handle) ?? null)
    }
    syncToUrl()
    window.addEventListener("popstate", syncToUrl)
    return () => window.removeEventListener("popstate", syncToUrl)
  }, [products])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
    setImageIndex(0)
  }, [selected])

  function openProduct(product: MedusaProduct, trigger: HTMLButtonElement) {
    openerRef.current = trigger
    const url = new URL(window.location.href)
    url.searchParams.set("producto", product.handle)
    window.history.pushState({ ...window.history.state, neniQuickView: true }, "", url)
    setSelected(product)
  }

  function closeProduct() {
    if (window.history.state?.neniQuickView) {
      window.history.back()
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete("producto")
      window.history.replaceState(window.history.state, "", url)
      setSelected(null)
    }
    openerRef.current?.focus()
  }

  function captureTone(handle: string, image: HTMLImageElement) {
    const tone = toneFromImage(image)
    if (tone) setTones(prev => prev[handle]?.ink === tone.ink ? prev : { ...prev, [handle]: tone })
  }

  function toneStyle(handle: string): CSSProperties {
    const tone = tones[handle]
    return tone ? { "--flower-wash": tone.wash, "--flower-ink": tone.ink, "--flower-frame": tone.frame } as CSSProperties : {}
  }

  const quickImages = selected ? Array.from(new Set([getProductImage(selected), selected.metadata?.image_2].filter((image): image is string => Boolean(image)))) : []

  if (loading) return <p className="catalog-feedback" role="status">Estamos preparando las flores del taller…</p>
  if (error) return <p className="catalog-feedback" role="alert">No pudimos cargar el catálogo desde el taller. Verifica la conexión con Medusa y vuelve a intentarlo.</p>
  if (!products.length) return <p className="catalog-feedback">Pronto florecerán nuevos diseños por aquí.</p>

  return (
    <>
      {cartError && <p className="catalog-feedback" role="alert">{cartError}</p>}
      <div className="products-grid">
        {products.map((product, index) => {
          const image = getProductImage(product)
          const price = getProductPrice(product)
          const variantId = getProductVariantId(product)
          return (
            <article key={product.id} className="product-card" data-product-handle={product.handle} style={toneStyle(product.handle)}>
              <div className="product-card__visual">
              <button type="button" className="product-card__media"
                aria-label={`Ver detalles de ${product.title}`}
                onClick={event => openProduct(product, event.currentTarget)}>
                {image && <img src={image} alt={product.title} loading="lazy" decoding="async" onLoad={event => captureTone(product.handle, event.currentTarget)} />}
                {product.metadata?.image_2 && product.metadata.image_2 !== image && <img className="product-card__secondary" src={product.metadata.image_2} alt="" loading="lazy" decoding="async" />}
                <span className="product-card__edition">{index < 3 ? "DESTACADO DEL TALLER" : "HECHO A MANO"}</span>
                <span className="product-card__preview">Ver este diseño ↗</span>
              </button>
              </div>
              <div className="product-card__content">
                <h3>{product.title}</h3>
                {product.metadata?.composition && <p className="composition">{product.metadata.composition}</p>}
                {product.description && <p className="product-card__description">{product.description}</p>}
                <div className="product-card__footer">
                  <strong>{price === undefined ? "Consultar" : formatCLP(price)}</strong>
                  <button type="button" disabled={!variantId || busy}
                    onClick={() => { if (variantId) void addItem(variantId, 1) }}>
                    {busy ? "Agregando…" : "Agregar +"}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <dialog ref={dialogRef} className="neni-dialog neni-quick-dialog" data-floral-scene style={selected ? toneStyle(selected.handle) : {}}
        aria-labelledby="neni-quick-title"
        onClose={() => { if (selected) closeProduct() }}
        onClick={event => { if (event.target === dialogRef.current) dialogRef.current?.close() }}>
        <canvas className="floral-scene__canvas" aria-hidden="true" />
        {selected && (
          <>
            <div className="neni-dialog__header">
              <span className="section-kicker">UN DISEÑO DEL TALLER</span>
              <button type="button" className="neni-dialog__close" aria-label="Cerrar detalle" autoFocus
                onClick={() => dialogRef.current?.close()}>×</button>
            </div>
            <div className="neni-quick-dialog__content">
              <div className="neni-quick-dialog__gallery">
                <div className="neni-quick-dialog__frame">
                {quickImages.length > 0 && <img src={quickImages[imageIndex] ?? quickImages[0]} alt={selected.title} />}
                </div>
                {quickImages.length > 1 && (
                  <div className="neni-quick-dialog__thumbnails" aria-label="Fotografías del diseño">
                    {quickImages.map((image, index) => (
                      <button key={image} type="button" aria-label={`Ver fotografía ${index + 1} de ${quickImages.length}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}>
                        <img src={image} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="neni-quick-dialog__text">
                <h2 id="neni-quick-title">{selected.title}</h2>
                {selected.metadata?.composition && <p className="composition">{selected.metadata.composition}</p>}
                {selected.description && <p>{selected.description}</p>}
                <strong>{getProductPrice(selected) === undefined ? "Consultar" : formatCLP(getProductPrice(selected))}</strong>
                <button type="button" disabled={!getProductVariantId(selected) || busy} onClick={() => {
                  const variant = getProductVariantId(selected)
                  if (variant) void addItem(variant, 1)
                }}>{busy ? "Agregando…" : "Agregar al carrito +"}</button>
              </div>
              <img className="neni-quick-dialog__ornament" src="/images/botanical/atelier-bloom.svg" alt="" aria-hidden="true" />
            </div>
          </>
        )}
      </dialog>
    </>
  )
}