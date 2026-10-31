/**
 * Neni v3/B3 — wind scenes beyond the hero.
 * Bounded Canvas2D drawings: catalog and React-mounted quick-view dialog.
 * One render loop per visible scene; pause on hidden/reduced-motion/modal close.
 * Mouse, pen and TOUCH share Pointer Events. This canvas never intercepts taps.
 */
(() => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)")
  const coarse = matchMedia("(pointer: coarse)")
  const scenes = new Map()
  const random = (min, max) => min + Math.random() * (max - min)
  const palette = [
    ["rgba(137,87,93,.29)", "rgba(241,189,181,.1)"],
    ["rgba(99,121,88,.28)", "rgba(204,210,166,.09)"],
    ["rgba(197,130,132,.27)", "rgba(246,210,194,.1)"],
    ["rgba(150,111,88,.25)", "rgba(228,190,156,.09)"]
  ]

  function mount(host) {
    if (scenes.has(host)) return
    const canvas = host.querySelector(".floral-scene__canvas")
    if (!(canvas instanceof HTMLCanvasElement)) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let width = 1, height = 1, raf = 0, previous = 0
    let visible = false, disposed = false, leaves = [], pointer = null
    const isDialog = host instanceof HTMLDialogElement
    const count = () => coarse.matches ? (isDialog ? 3 : 7) : (isDialog ? 7 : 18)
    const active = () => !disposed && visible && !document.hidden && !motion.matches &&
      (!isDialog || host.open)

    function mote(randomX = false) {
      return {
        x: randomX ? random(0,width) : random(-50,-8),
        y: random(0,height), width: random(7,coarse.matches ? 15 : 21),
        angle: random(0,Math.PI*2), base: random(0,Math.PI*2),
        vx: random(.13,.34), vy: random(-.035,.09),
        rotation: random(-.005,.005),
        tone: palette[Math.floor(Math.random()*palette.length)]
      }
    }
    function resize() {
      const box = canvas.getBoundingClientRect()
      width = Math.max(1,box.width)
      height = Math.max(1,box.height)
      if (width <= 2 || height <= 2) return
      const dpr = Math.min(devicePixelRatio || 1,1.7)
      canvas.width = Math.round(width*dpr)
      canvas.height = Math.round(height*dpr)
      ctx.setTransform(dpr,0,0,dpr,0,0)
      leaves = Array.from({length:count()},()=>mote(true))
    }
    function drawLeaf(leaf,time) {
      ctx.save()
      ctx.translate(leaf.x,leaf.y + Math.sin(time*.0007+leaf.base)*5)
      ctx.rotate(leaf.angle)
      ctx.scale(leaf.width,leaf.width*.58)
      const gradient = ctx.createLinearGradient(-1,0,1,0)
      gradient.addColorStop(0,leaf.tone[0])
      gradient.addColorStop(.65,leaf.tone[1])
      gradient.addColorStop(1,leaf.tone[0])
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(-1.1,0)
      ctx.bezierCurveTo(-.45,-.91,.51,-.83,1.1,0)
      ctx.bezierCurveTo(.41,.9,-.6,.86,-1.1,0)
      ctx.fill()
      ctx.strokeStyle = "rgba(93,85,73,.07)"
      ctx.lineWidth = .035
      ctx.beginPath()
      ctx.moveTo(-1,0)
      ctx.quadraticCurveTo(0,-.08,1,0)
      ctx.stroke()
      ctx.restore()
    }
    function frame(time) {
      raf = requestAnimationFrame(frame)
      if (time-previous < 31) return // ~30 FPS maximum
      const dt = Math.min((time-(previous || time))/16.667,2)
      previous = time
      ctx.clearRect(0,0,width,height)
      for (const leaf of leaves) {
        const dx = pointer ? leaf.x-pointer.x : 1e5
        const dy = pointer ? leaf.y-pointer.y : 1e5
        const distance = Math.hypot(dx,dy)
        const wind = distance < 190 ? (1-distance/190)*.75 : 0
        leaf.x += (leaf.vx+wind)*dt
        leaf.y += (leaf.vy+Math.sin(time*.00035+leaf.base)*.12-wind*.12)*dt
        leaf.angle += leaf.rotation*dt+wind*.003
        if (leaf.x>width+40 || leaf.y>height+45 || leaf.y< -45) Object.assign(leaf,mote(false))
        drawLeaf(leaf,time)
      }
    }
    function sync() {
      if (active()) {
        if (!raf) { previous=0; raf=requestAnimationFrame(frame) }
      } else {
        if (raf) cancelAnimationFrame(raf)
        raf=0
        ctx.clearRect(0,0,width,height)
      }
    }
    function onPointer(event) {
      if (!active()) return
      const r = canvas.getBoundingClientRect()
      if (event.clientX>=r.left && event.clientX<=r.right &&
          event.clientY>=r.top && event.clientY<=r.bottom) {
        pointer={x:event.clientX-r.left,y:event.clientY-r.top}
      } else pointer=null
    }
    function onLeave() { pointer=null }
    const intersection = new IntersectionObserver(
      ([entry])=>{visible=Boolean(entry?.isIntersecting); sync()},
      {rootMargin:"60px",threshold:0}
    )
    const resizeObserver = new ResizeObserver(()=>{resize();sync()})
    const openObserver = isDialog ? new MutationObserver(()=>{resize();sync()}) : null
    resize()
    intersection.observe(host)
    resizeObserver.observe(host)
    openObserver?.observe(host,{attributes:true,attributeFilter:["open"]})
    window.addEventListener("pointermove",onPointer,{passive:true})
    window.addEventListener("pointerdown",onPointer,{passive:true})
    window.addEventListener("pointerup",onLeave,{passive:true})
    const onVisibility=()=>sync()
    const onMotion=()=>sync()
    document.addEventListener("visibilitychange",onVisibility)
    motion.addEventListener("change",onMotion)
    const dispose=()=>{
      disposed=true;sync()
      intersection.disconnect();resizeObserver.disconnect();openObserver?.disconnect()
      window.removeEventListener("pointermove",onPointer)
      window.removeEventListener("pointerdown",onPointer)
      window.removeEventListener("pointerup",onLeave)
      document.removeEventListener("visibilitychange",onVisibility)
      motion.removeEventListener("change",onMotion)
    }
    scenes.set(host,dispose)
    sync()
  }

  const discover=()=>document.querySelectorAll("[data-floral-scene]").forEach(mount)
  discover()
  const reactObserver = new MutationObserver(records=>{
    if (records.some(record=>record.addedNodes.length)) discover()
  })
  reactObserver.observe(document.body,{childList:true,subtree:true})
  window.addEventListener("pagehide",()=>{
    reactObserver.disconnect()
    scenes.forEach(dispose=>dispose())
    scenes.clear()
  },{once:true})
})()
