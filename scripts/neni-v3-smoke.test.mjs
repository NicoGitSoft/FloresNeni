import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = file => readFileSync(resolve(root, file), "utf8")
const wind = source("apps/storefront/public/js/botanical-wind.js")

test("home static artwork references resolve to real public assets", () => {
  const home = source("apps/storefront/src/pages/index.astro")
  const all = [...home.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(match => match[1])
  for (const path of all) {
    if (path.startsWith("/#")) continue
    if (path === "/") continue
    assert.ok(existsSync(resolve(root, "apps/storefront/public" + path)),
      "Missing static asset: " + path)
  }
})

test("React monorepo boundaries preserve Medusa 18 and storefront 19", () => {
  const project = JSON.parse(source("package.json"))
  const storefront = JSON.parse(source("apps/storefront/package.json"))
  const backend = JSON.parse(source("apps/backend/package.json"))
  const lockRoot = source("pnpm-lock.yaml").split("  apps/backend:")[0]
  assert.equal(project.devDependencies.react, undefined)
  assert.equal(project.devDependencies["react-dom"], undefined)
  assert.match(storefront.dependencies.react, /^\^19\./)
  assert.match(storefront.dependencies["react-dom"], /^\^19\./)
  assert.match(backend.devDependencies.react, /^\^18\./)
  assert.doesNotMatch(lockRoot, /^      react:/m)
  assert.doesNotMatch(lockRoot, /^      react-dom:/m)
})

test("checkout never downloads ambient animation", () => {
  const checkout = source("apps/storefront/src/pages/checkout.astro")
  assert.doesNotMatch(checkout, /botanical-wind\.js/)
  assert.match(checkout, /class="neni-v3"/)
  assert.match(checkout, /<CheckoutPage client:load/)
})

function bootWind(reduced) {
  const calls = { scheduled: 0, cancelled: 0, cleared: 0, listeners: {}, media: {} }
  class Element {
    getBoundingClientRect() { return { width: 900, height: 600, left: 0, top: 0 } }
    addEventListener(name, listener) { calls.listeners["host:" + name] = listener }
    removeEventListener() {}
  }
  const draw = {
    setTransform() {}, clearRect() { calls.cleared++ }, beginPath() {}, moveTo() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, fill() {}, stroke() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    createLinearGradient() { return { addColorStop() {} } },
  }
  class Canvas {
    style = {}
    getContext() { return draw }
  }
  const canvas = new Canvas()
  const host = Object.assign(new Element(), { querySelector() { return canvas } })
  const motion = { matches: reduced, addEventListener(name, cb) { calls.media.motion = cb }, removeEventListener() {} }
  const coarse = { matches: false, addEventListener() {}, removeEventListener() {} }
  const document = { hidden: false, querySelector() { return host },
    addEventListener(name, cb) { calls.listeners["document:" + name] = cb },
    removeEventListener() {} }
  const window = {
    devicePixelRatio: 1,
    matchMedia(query) { return query.includes("reduced-motion") ? motion : coarse },
    addEventListener(name, cb) { calls.listeners["window:" + name] = cb },
  }
  runInNewContext(wind, {
    document, window, HTMLElement: Element, HTMLCanvasElement: Canvas,
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame() { calls.scheduled++; return calls.scheduled },
    cancelAnimationFrame() { calls.cancelled++ },
    Math,
  }, { timeout: 2000 })
  return { calls, document, motion }
}

test("ambient Canvas schedules a frame when motion is allowed", () => {
  const { calls } = bootWind(false)
  assert.equal(calls.scheduled, 1)
})

test("reduced motion disables ambient Canvas without scheduling frames", () => {
  const { calls } = bootWind(true)
  assert.equal(calls.scheduled, 0)
  assert.ok(calls.cleared >= 1)
})

test("hidden tab cancels active frame, resuming on visibility", () => {
  const { calls, document } = bootWind(false)
  document.hidden = true
  calls.listeners["document:visibilitychange"]()
  assert.equal(calls.cancelled, 1)
  document.hidden = false
  calls.listeners["document:visibilitychange"]()
  assert.equal(calls.scheduled, 2)
})
