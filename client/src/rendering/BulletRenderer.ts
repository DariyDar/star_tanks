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

      // Trail — line behind bullet in opposite direction of travel
      const trailLen = cellPx * 0.6
      const tailX = cx - Math.sin(bullet.angle) * trailLen
      const tailY = cy + Math.cos(bullet.angle) * trailLen

      const trailGrad = ctx.createLinearGradient(tailX, tailY, cx, cy)
      trailGrad.addColorStop(0, 'rgba(255, 150, 0, 0)')
      trailGrad.addColorStop(0.6, 'rgba(255, 180, 0, 0.4)')
      trailGrad.addColorStop(1, 'rgba(255, 215, 0, 0.8)')

      ctx.strokeStyle = trailGrad
      ctx.lineWidth = cellPx * 0.12
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      // Bullet glow
      ctx.shadowColor = '#FF8800'
      ctx.shadowBlur = 6

      // Bullet body
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      // Bright core
      ctx.fillStyle = '#FFF'
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
    }
  }
}
