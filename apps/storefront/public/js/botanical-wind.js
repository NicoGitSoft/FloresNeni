/**
 * Neni botanical wind. Dependency-free Canvas2D decoration.
 * Intentionally independent from React, Medusa and checkout.
 */
const host = document.querySelector("[data-botanical-wind]");
if (host instanceof HTMLElement) {
  const canvas = host.querySelector("canvas");
  const context = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d", { alpha: true }) : null;
  if (context && canvas) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    }, { threshold: 0.01 });
    let visible = true;
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let motes = [];
    let pointer = null;
    let disposed = false;
    const palette = [
      ["rgba(149,77,87,.38)", "rgba(230,181,172,.17)"],
      ["rgba(100,119,87,.35)", "rgba(199,190,151,.16)"],
      ["rgba(170,113,106,.31)", "rgba(245,215,193,.21)"],
      ["rgba(116,72,84,.27)", "rgba(214,177,179,.14)"]
    ];
    const random = (a, b) => a + Math.random() * (b - a);
    function createMote(randomX = false) {
      return {
        x: randomX ? random(-width * .1, width) : random(-width * .2, -10),
        y: random(0, height), base: random(0, Math.PI * 2),
        size: random(6, coarsePointer.matches ? 15 : 24),
        drift: random(.11, .29), fall: random(-.04, .08),
        turn: random(-.005, .005), angle: random(0, Math.PI * 2),
        velocity: 0, palette: palette[Math.floor(Math.random() * palette.length)]
      };
    }
    function resize() {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: coarsePointer.matches ? 5 : 14 }, () => createMote(true));
    }
    function drawLeaf(mote, time) {
      context.save();
      context.translate(mote.x, mote.y + Math.sin(time * .00035 + mote.base) * 8);
      context.rotate(mote.angle + Math.sin(time * .00022 + mote.base) * .17);
      context.scale(mote.size, mote.size);
      const shade = mote.palette;
      const wash = context.createLinearGradient(-1, -1, 1, 1);
      wash.addColorStop(0, shade[0]);
      wash.addColorStop(.67, shade[1]);
      wash.addColorStop(1, shade[0]);
      context.fillStyle = wash;
      context.beginPath();
      context.moveTo(-1.1, 0);
      context.bezierCurveTo(-.55, -.82, .62, -.78, 1.15, 0);
      context.bezierCurveTo(.5, .82, -.48, .65, -1.1, 0);
      context.fill();
      context.strokeStyle = "rgba(88,77,71,.10)";
      context.lineWidth = .032;
      context.beginPath();
      context.moveTo(-.94, 0);
      context.quadraticCurveTo(.12, -.11, 1.08, 0);
      context.stroke();
      context.restore();
    }
    function tick(time) {
      raf = 0;
      const delta = Math.min((time - (last || time)) / 16.667, 2);
      last = time;
      context.clearRect(0, 0, width, height);
      for (const mote of motes) {
        const dy = Math.sin(time * .00023 + mote.base) * .18;
        const d = pointer ? Math.hypot(mote.x - pointer.x, mote.y - pointer.y) : Infinity;
        const force = d < 180 ? ((180 - d) / 180) * .065 : 0;
        mote.velocity = (mote.velocity + force * delta) * .985;
        mote.x += (mote.drift + mote.velocity) * delta;
        mote.y += (mote.fall + dy) * delta;
        mote.angle += mote.turn * delta;
        if (mote.x > width + 35 || mote.y < -35 || mote.y > height + 35) {
          Object.assign(mote, createMote(false));
        }
        drawLeaf(mote, time);
      }
      if (shouldRun()) raf = requestAnimationFrame(tick);
    }
    function shouldRun() {
      return !disposed && visible && !document.hidden && !reduceMotion.matches;
    }
    function sync() {
      if (shouldRun()) {
        if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        context.clearRect(0, 0, width, height);
      }
    }
    const resizeObserver = new ResizeObserver(() => { resize(); sync(); });
    const onPointerMove = (event) => {
      const r = host.getBoundingClientRect();
      pointer = { x: event.clientX - r.left, y: event.clientY - r.top };
    };
    const onPointerLeave = () => { pointer = null; };
    const onVisibility = () => sync();
    const onMotion = () => { resize(); sync(); };
    const onPageHide = () => {
      disposed = true;
      sync();
      observer.disconnect();
      resizeObserver.disconnect();
      reduceMotion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
    resize();
    observer.observe(host);
    resizeObserver.observe(host);
    reduceMotion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerdown", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pagehide", onPageHide, { once: true });
    sync();
  }
}
