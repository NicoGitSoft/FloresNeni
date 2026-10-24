/**
 * Neni floral colour harmony.
 * Browser-side, origin-clean Canvas2D sampling of real Medusa product photography.
 * NOT segmentation or a guaranteed perceptual match: central chroma-weighted hue
 * clustering deliberately deprioritises common blue studio backdrops and foliage.
 * Sampling is bounded to 72² pixels; never uploads customer/product images.
 */
export type FloralTone = { wash: string; ink: string; frame: string }
const cache = new Map<string, FloralTone>()

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const mix = (a: number, b: number, alpha: number) => Math.round(a * (1 - alpha) + b * alpha)

export function selectFloralTone(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): FloralTone | null {
  if (!width || !height || rgba.length < width * height * 4) return null
  const bins = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }))
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const p = (y * width + x) * 4
      if (rgba[p + 3] < 200) continue
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const chroma = max - min
      const saturation = max === 0 ? 0 : chroma / max
      if (saturation < .22 || max < 50 || max > 248 || chroma < 30) continue
      let hue = 0
      if (chroma) {
        if (max === r) hue = ((g - b) / chroma) % 6
        else if (max === g) hue = (b - r) / chroma + 2
        else hue = (r - g) / chroma + 4
      }
      hue = ((hue * 60) + 360) % 360
      const dx = (x / width - .5) * 2, dy = (y / height - .53) * 2
      const center = clamp(1 - .48 * (dx * dx + dy * dy), .34, 1)
      // Flowers, not blue/teal studio paper or the usually-green foliage.
      const floral = hue >= 175 && hue <= 260 ? .39 : hue >= 75 && hue <= 170 ? .72 : 1.2
      const weight = saturation ** 1.6 * center * floral
      const bucket = bins[Math.floor(hue / 15)]
      bucket.weight += weight
      bucket.r += r * weight
      bucket.g += g * weight
      bucket.b += b * weight
    }
  }
  const best = bins.reduce((a, b) => b.weight > a.weight ? b : a)
  if (best.weight < 1) return null
  const r = best.r / best.weight, g = best.g / best.weight, b = best.b / best.weight
  // Marfil + selected bouquet chroma: keep the surface light and text legible.
  return {
    wash: `rgb(${mix(r, 250, .82)} ${mix(g, 246, .82)} ${mix(b, 239, .82)})`,
    frame: `rgb(${mix(r, 246, .47)} ${mix(g, 235, .47)} ${mix(b, 223, .47)})`,
    ink: `rgb(${mix(r, 73, .32)} ${mix(g, 49, .32)} ${mix(b, 53, .32)})`
  }
}

export function toneFromImage(image: HTMLImageElement): FloralTone | null {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null
  const key = image.currentSrc || image.src
  const existing = cache.get(key)
  if (existing) return existing
  try {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 72
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const palette = selectFloralTone(ctx.getImageData(0, 0, 72, 72).data, 72, 72)
    if (palette) cache.set(key, palette)
    return palette
  } catch {
    // External photography without CORS / tainted canvas: neutral CSS fallback.
    return null
  }
}
