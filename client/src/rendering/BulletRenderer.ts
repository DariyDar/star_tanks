import type { Bullet } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

export class BulletRenderer {
  render(ctx: CanvasRenderingContext2D, bullets: Bullet[], camera: Camera, cellPx: number): void {
    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = '#FF8800'
    ctx.shadowBlur = 4

    for (const bullet of bullets) {
      if (!camera.isVisible(bullet.position.x, bullet.position.y)) continue

      const { sx, sy } = camera.worldToScreen(bullet.position.x, bullet.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2
      const r = cellPx * 0.15

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0
  }
}
