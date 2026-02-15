import type { Bullet } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

export class BulletRenderer {
  render(ctx: CanvasRenderingContext2D, bullets: Bullet[], camera: Camera, cellPx: number): void {
    for (const bullet of bullets) {
      if (!camera.isVisible(bullet.position.x, bullet.position.y)) continue

      const { sx, sy } = camera.worldToScreen(bullet.position.x, bullet.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2
      const r = cellPx * 0.12

      // Enhanced trail with 3D glow effect
      const trailLen = cellPx * 0.8
      const tailX = cx - Math.sin(bullet.angle) * trailLen
      const tailY = cy + Math.cos(bullet.angle) * trailLen

      // Outer glow trail
      const outerTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      outerTrail.addColorStop(0, 'rgba(255, 100, 0, 0)')
      outerTrail.addColorStop(0.5, 'rgba(255, 150, 0, 0.2)')
      outerTrail.addColorStop(1, 'rgba(255, 200, 0, 0.5)')

      ctx.strokeStyle = outerTrail
      ctx.lineWidth = cellPx * 0.25
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      // Inner bright trail
      const innerTrail = ctx.createLinearGradient(tailX, tailY, cx, cy)
      innerTrail.addColorStop(0, 'rgba(255, 220, 100, 0)')
      innerTrail.addColorStop(0.6, 'rgba(255, 230, 150, 0.6)')
      innerTrail.addColorStop(1, 'rgba(255, 255, 200, 0.9)')

      ctx.strokeStyle = innerTrail
      ctx.lineWidth = cellPx * 0.12
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      // Bullet outer glow (3D effect)
      ctx.shadowColor = '#FF6600'
      ctx.shadowBlur = 12
      ctx.fillStyle = 'rgba(255, 150, 0, 0.6)'
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2)
      ctx.fill()

      // Bullet main glow
      ctx.shadowBlur = 8
      ctx.shadowColor = '#FFAA00'

      // Bullet body with radial gradient (3D sphere)
      const bulletGradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
      bulletGradient.addColorStop(0, '#FFFFD0')
      bulletGradient.addColorStop(0.4, '#FFD700')
      bulletGradient.addColorStop(1, '#FF8800')

      ctx.fillStyle = bulletGradient
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      // Bright core highlight
      ctx.shadowBlur = 4
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.4, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
    }
  }
}
