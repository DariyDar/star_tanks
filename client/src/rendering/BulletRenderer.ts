import type { Bullet } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

export class BulletRenderer {
  render(ctx: CanvasRenderingContext2D, bullets: Bullet[], camera: Camera, cellPx: number): void {
    for (const bullet of bullets) {
      if (!camera.isVisible(bullet.position.x, bullet.position.y)) continue

      const { sx: cx, sy: cy } = camera.worldToScreen(bullet.position.x, bullet.position.y, cellPx)

      if (bullet.isRocket) {
        this.renderRocket(ctx, cx, cy, bullet, cellPx)
      } else {
        this.renderBullet(ctx, cx, cy, bullet, cellPx)
      }
    }
  }

  private renderBullet(ctx: CanvasRenderingContext2D, cx: number, cy: number, bullet: Bullet, cellPx: number): void {
    const r = cellPx * 0.12

    // Clamp trail to actual distance traveled to avoid glitchy flash on spawn
    const maxTrail = cellPx * 0.8
    const actualTrail = Math.min(maxTrail, bullet.distanceTraveled * cellPx)

    // Skip trail if bullet just spawned
    if (actualTrail > cellPx * 0.05) {
      const tailX = cx - Math.sin(bullet.angle) * actualTrail
      const tailY = cy + Math.cos(bullet.angle) * actualTrail

      // Outer glow trail
      const outerTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      outerTrail.addColorStop(0, 'rgba(255, 100, 0, 0)')
      outerTrail.addColorStop(0.5, 'rgba(255, 150, 0, 0.2)')
      outerTrail.addColorStop(1, 'rgba(255, 200, 0, 0.5)')

      ctx.strokeStyle = outerTrail
      ctx.lineWidth = cellPx * 0.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      // Inner bright trail
      const innerTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      innerTrail.addColorStop(0, 'rgba(255, 220, 100, 0)')
      innerTrail.addColorStop(0.6, 'rgba(255, 230, 150, 0.5)')
      innerTrail.addColorStop(1, 'rgba(255, 255, 200, 0.8)')

      ctx.strokeStyle = innerTrail
      ctx.lineWidth = cellPx * 0.08
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()
    }

    // Bullet body with radial gradient
    const bulletGradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
    bulletGradient.addColorStop(0, '#FFFFD0')
    bulletGradient.addColorStop(0.4, '#FFD700')
    bulletGradient.addColorStop(1, '#FF8800')

    ctx.fillStyle = bulletGradient
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    // Bright core highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }

  private renderRocket(ctx: CanvasRenderingContext2D, cx: number, cy: number, bullet: Bullet, cellPx: number): void {
    const r = cellPx * 0.22 // Rockets are ~2x bigger

    // Smoke trail
    const maxTrail = cellPx * 1.2
    const actualTrail = Math.min(maxTrail, bullet.distanceTraveled * cellPx)

    if (actualTrail > cellPx * 0.05) {
      const tailX = cx - Math.sin(bullet.angle) * actualTrail
      const tailY = cy + Math.cos(bullet.angle) * actualTrail

      // Smoke trail (wider, grey)
      const smokeTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      smokeTrail.addColorStop(0, 'rgba(100, 100, 100, 0)')
      smokeTrail.addColorStop(0.3, 'rgba(150, 150, 150, 0.15)')
      smokeTrail.addColorStop(0.7, 'rgba(200, 100, 50, 0.3)')
      smokeTrail.addColorStop(1, 'rgba(255, 150, 50, 0.6)')

      ctx.strokeStyle = smokeTrail
      ctx.lineWidth = cellPx * 0.35
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      // Fire trail (inner, bright orange)
      const fireTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      fireTrail.addColorStop(0, 'rgba(255, 100, 0, 0)')
      fireTrail.addColorStop(0.5, 'rgba(255, 200, 50, 0.4)')
      fireTrail.addColorStop(1, 'rgba(255, 255, 100, 0.8)')

      ctx.strokeStyle = fireTrail
      ctx.lineWidth = cellPx * 0.12
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()
    }

    // Rocket body (elongated along direction)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(bullet.angle)

    // Main body (dark red/orange)
    const bodyGrad = ctx.createLinearGradient(-r * 0.4, 0, r * 0.4, 0)
    bodyGrad.addColorStop(0, '#AA2200')
    bodyGrad.addColorStop(0.5, '#FF4400')
    bodyGrad.addColorStop(1, '#CC3300')

    ctx.fillStyle = bodyGrad
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.4, r, 0, 0, Math.PI * 2)
    ctx.fill()

    // Warhead tip (bright orange)
    ctx.fillStyle = '#FF6600'
    ctx.beginPath()
    ctx.moveTo(-r * 0.25, -r)
    ctx.lineTo(0, -r * 1.3)
    ctx.lineTo(r * 0.25, -r)
    ctx.closePath()
    ctx.fill()

    // Exhaust glow at tail
    ctx.fillStyle = 'rgba(255, 200, 50, 0.6)'
    ctx.beginPath()
    ctx.arc(0, r * 0.8, r * 0.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // Outer glow
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#FF6600'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
