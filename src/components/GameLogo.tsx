import { useEffect, useRef } from 'react'
import { asset } from '@/assets'

/**
 * The wordmark, lit.
 *
 * A still hero reads as a loading state until something in it moves, but a
 * field of drifting particles reads as ambience — wrong for a game about
 * fighting. So the motion is anchored to the logo instead: a glow that
 * breathes behind it and sparks thrown off its edges, as if the emblem itself
 * is hot.
 *
 * Everything is drawn on one canvas sitting *behind* the image, so sparks
 * appear from under the wordmark and fly clear of it. That gives the effect
 * depth for free and keeps the artwork itself unobstructed — the logo is the
 * one thing on this page that must stay legible.
 *
 * The palette is the logo's own: amber from the wordmark, cyan from the
 * emblem at its centre.
 */

const AMBER = '255, 168, 24'
const CYAN = '90, 206, 255'

/**
 * Sparks alive at once.
 *
 * Deliberately sparse. The point is a wordmark that looks hot, not a
 * particle effect: enough that something is always catching the eye's
 * corner, few enough that nothing pulls it away from the logo.
 */
const SPARKS = 24

interface Spark {
  /** Position and velocity in canvas space. */
  x: number
  y: number
  vx: number
  vy: number
  r: number
  colour: string
  peak: number
  age: number
  span: number
  flick: number
  flickRate: number
}

/*
 * Where the logo sits inside the canvas.
 *
 * The canvas overhangs the image so sparks have room to travel, so the
 * wordmark's own half-width and half-height are these fractions of it —
 * 100/170 and 100/260, halved. Spawning against the canvas instead would put
 * every spark inside the image and hide the lot behind it.
 */
const LOGO_HALF_W = 0.294
const LOGO_HALF_H = 0.192

/**
 * Sparks are born on the wordmark's edge, not its centre.
 *
 * The logo is far wider than it is tall, so a circular emitter would spray
 * most of them into empty space above and below. Seeding an ellipse matched
 * to the image's proportions puts them where the metal is.
 */
function spawn(w: number, h: number, seeded: boolean): Spark {
  const angle = Math.random() * Math.PI * 2
  /* Straddle the rim: some struck just inside the metal, some just off it. */
  const edge = 0.86 + Math.random() * 0.26

  const x = w / 2 + Math.cos(angle) * (w * LOGO_HALF_W) * edge
  const y = h / 2 + Math.sin(angle) * (h * LOGO_HALF_H) * edge

  /* Outward from the centre, with a lift so the field drifts upward. */
  const speed = 32 + Math.random() * 78
  const cyan = Math.random() < 0.28

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (22 + Math.random() * 40),
    r: 0.9 + Math.random() * 1.7,
    colour: cyan ? CYAN : AMBER,
    peak: 0.34 + Math.random() * 0.3,
    age: seeded ? Math.random() * 2.8 : 0,
    span: 2.4 + Math.random() * 2.6,
    flick: Math.random() * Math.PI * 2,
    flickRate: 8 + Math.random() * 12,
  }
}

export function GameLogo({
  className,
  width = 337,
  height = 152,
  priority = false,
}: {
  className?: string
  width?: number
  height?: number
  /** Set on the hero, where this image *is* the first paint. */
  priority?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    /* The Display setting owns this: low means no decorative motion at all. */
    if (document.documentElement.dataset.fx === 'low') return

    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let sparks: Spark[] = []
    let frame = 0
    let last = 0
    let clock = 0
    let onScreen = true
    let visible = !document.hidden

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      /* Cap the buffer at 2x: past that this is pure cost on a phone. */
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!sparks.length) {
        sparks = Array.from({ length: SPARKS }, () => spawn(w, h, true))
      }
    }

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)

      /* Clamp the step: a backgrounded tab resumes with a huge delta. */
      const dt = Math.min((now - (last || now)) / 1000, 0.05)
      last = now
      if (!onScreen || !visible) return
      clock += dt

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'

      /*
        The glow: two breathing pools on different periods so they drift in
        and out of phase and never settle into an obvious loop. Amber spread
        wide behind the wordmark, cyan tight behind the emblem at the centre.
      */
      const cx = w / 2
      const cy = h / 2
      const slow = 0.5 + 0.5 * Math.sin(clock * 0.62)
      const fast = 0.5 + 0.5 * Math.sin(clock * 0.95 + 1.1)

      const wide = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.42)
      wide.addColorStop(0, `rgba(${AMBER}, ${0.18 + slow * 0.09})`)
      wide.addColorStop(0.45, `rgba(${AMBER}, ${0.07 + slow * 0.04})`)
      wide.addColorStop(1, `rgba(${AMBER}, 0)`)
      ctx.fillStyle = wide
      ctx.fillRect(0, 0, w, h)

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.3)
      core.addColorStop(0, `rgba(${CYAN}, ${0.15 + fast * 0.1})`)
      core.addColorStop(1, `rgba(${CYAN}, 0)`)
      ctx.fillStyle = core
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i]

        s.age += dt
        /*
           Sparks now outlive the box they are drawn in, so one that leaves is
           replaced rather than clipped hard against the canvas edge.
         */
        if (
          s.age >= s.span ||
          s.x < -20 ||
          s.x > w + 20 ||
          s.y < -20 ||
          s.y > h + 20
        ) {
          sparks[i] = spawn(w, h, false)
          continue
        }

        /* Drag, so sparks shoot out and coast to a stop rather than leaving
           at a constant rate — the shape that reads as thrown off. */
        s.vx *= 1 - 0.72 * dt
        s.vy *= 1 - 0.72 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.flick += s.flickRate * dt

        const t = s.age / s.span
        /* Fast attack, long decay: struck, then guttering out. */
        const envelope = t < 0.06 ? t / 0.06 : 1 - (t - 0.06) / 0.94
        const alpha =
          Math.max(0, envelope) * (0.75 + 0.25 * Math.sin(s.flick)) * s.peak
        if (alpha <= 0.005) continue

        const speed = Math.hypot(s.vx, s.vy)
        if (speed > 14) {
          const tail = 0.1
          const tx = s.x - s.vx * tail
          const ty = s.y - s.vy * tail

          const streak = ctx.createLinearGradient(s.x, s.y, tx, ty)
          streak.addColorStop(0, `rgba(${s.colour}, ${alpha * 0.8})`)
          streak.addColorStop(1, `rgba(${s.colour}, 0)`)
          ctx.strokeStyle = streak
          ctx.lineWidth = s.r * 1.5
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(s.x, s.y)
          ctx.stroke()
        }

        const reach = s.r * 4.8
        const head = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, reach)
        head.addColorStop(0, `rgba(255, 248, 232, ${alpha})`)
        head.addColorStop(0.3, `rgba(${s.colour}, ${alpha * 0.8})`)
        head.addColorStop(1, `rgba(${s.colour}, 0)`)
        ctx.fillStyle = head
        ctx.beginPath()
        ctx.arc(s.x, s.y, reach, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    resize()
    frame = requestAnimationFrame(draw)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    const onVisibility = () => {
      visible = !document.hidden
      if (visible) last = 0
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <span className="logofx">
      <canvas ref={ref} className="logofx__canvas" aria-hidden="true" />
      <img
        {...(priority ? { fetchpriority: 'high' } : {})}
        className={className}
        src={asset("/assets/logo.png")}
        alt="Alien Legends"
        width={width}
        height={height}
        decoding="async"
      />
    </span>
  )
}
