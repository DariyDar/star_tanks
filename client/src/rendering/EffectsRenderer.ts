import type { Camera } from '../game/Camera.js'
import { PORTAL_EXIT_FADE_DURATION } from '@shared/constants.js'

interface Explosion {
  x: number
  y: number
  startTime: number
  duration: number
}

export class EffectsRenderer {
  private explosions: Explosion[] = []
  private fadeStartTime = 0
  private fadeColor: 'white' | 'black' | null = null
  private fadeDuration = PORTAL_EXIT_FADE_DURATION

  addExplosion(x: number, y: number): void {
    this.explosions.push({
      x, y,
      startTime: Date.now(),
      duration: 500
    })
  }

  startFade(color: 'white' | 'black'): void {
    this.fadeStartTime = Date.now()
    this.fadeColor = color
  }

  get isFading(): boolean {
    return this.fadeColor !== null && (Date.now() - this.fadeStartTime) < this.fadeDuration
  }

  get fadeComplete(): boolean {
    return this.fadeColor !== null && (Date.now() - this.fadeStartTime) >= this.fadeDuration
  }

  renderExplosions(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.explosions = this.explosions.filter(e => now - e.startTime < e.duration)

    for (const exp of this.explosions) {
      const t = (now - exp.startTime) / exp.duration
      const { sx, sy } = camera.worldToScreen(exp.x, exp.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const maxR = cellPx * 1.5
      const r = maxR * t
      const alpha = 1 - t

      // Outer glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0, `rgba(255, 200, 50, ${alpha})`)
      grad.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.6})`)
      grad.addColorStop(1, `rgba(255, 0, 0, 0)`)

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  renderPortals(
    ctx: CanvasRenderingContext2D,
    portals: Array<{ position: { x: number; y: number } }>,
    camera: Camera,
    cellPx: number
  ): void {
    const now = Date.now()
    for (const portal of portals) {
      if (!camera.isVisible(portal.position.x, portal.position.y)) continue

      const { sx, sy } = camera.worldToScreen(portal.position.x, portal.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      // Spinning portal effect
      const angle = now / 500
      const pulse = 0.8 + Math.sin(now / 300) * 0.2
      const r = cellPx * 0.45 * pulse

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)

      // Outer ring
      ctx.strokeStyle = '#00FFFF'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()

      // Inner glow
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.4)')
      grad.addColorStop(1, 'rgba(0, 100, 255, 0.1)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()

      // Spiral arms
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'
      ctx.lineWidth = 1
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath()
        const armAngle = (arm * Math.PI * 2) / 3
        for (let t = 0; t < 1; t += 0.05) {
          const spiralR = r * t
          const spiralAngle = armAngle + t * Math.PI * 2
          const px = spiralR * Math.cos(spiralAngle)
          const py = spiralR * Math.sin(spiralAngle)
          if (t === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  renderFade(ctx: CanvasRenderingContext2D): void {
    if (!this.fadeColor) return

    const elapsed = Date.now() - this.fadeStartTime
    const alpha = Math.min(1, elapsed / this.fadeDuration)

    ctx.fillStyle = this.fadeColor === 'white'
      ? `rgba(255, 255, 255, ${alpha})`
      : `rgba(0, 0, 0, ${alpha})`
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  renderPortalArrow(
    ctx: CanvasRenderingContext2D,
    myPos: { x: number; y: number },
    portalPos: { x: number; y: number },
    canvasSize: number
  ): void {
    const dx = portalPos.x - myPos.x
    const dy = portalPos.y - myPos.y
    const angle = Math.atan2(dy, dx)

    const arrowDist = canvasSize / 2 - 30
    const arrowX = canvasSize / 2 + Math.cos(angle) * arrowDist
    const arrowY = canvasSize / 2 + Math.sin(angle) * arrowDist

    ctx.save()
    ctx.translate(arrowX, arrowY)
    ctx.rotate(angle)

    // Arrow
    ctx.fillStyle = '#00FFFF'
    ctx.beginPath()
    ctx.moveTo(12, 0)
    ctx.lineTo(-6, -8)
    ctx.lineTo(-6, 8)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  reset(): void {
    this.explosions = []
    this.fadeColor = null
  }
}
