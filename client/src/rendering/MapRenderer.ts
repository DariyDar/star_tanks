import { ObstacleType, type Obstacle } from '@shared/types.js'
import { VIEWPORT_CELLS } from '@shared/constants.js'
import type { Camera } from '../game/Camera.js'

const OBSTACLE_COLORS: Record<ObstacleType, string> = {
  [ObstacleType.Brick]: '#C84B31',
  [ObstacleType.Steel]: '#7F8487',
  [ObstacleType.Water]: '#1A73E8',
  [ObstacleType.Bush]: '#2D6A4F'
}

export class MapRenderer {
  private obstacleGrid = new Map<string, Obstacle>()

  loadObstacles(obstacles: Obstacle[]): void {
    this.obstacleGrid.clear()
    for (const obs of obstacles) {
      this.obstacleGrid.set(`${obs.x},${obs.y}`, obs)
    }
  }

  removeObstacle(x: number, y: number): void {
    this.obstacleGrid.delete(`${x},${y}`)
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const startX = Math.floor(camera.x)
    const startY = Math.floor(camera.y)
    const endX = startX + VIEWPORT_CELLS + 1
    const endY = startY + VIEWPORT_CELLS + 1

    // Ground
    ctx.fillStyle = '#3A3A3A'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Grid lines
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 0.5
    for (let gy = startY; gy <= endY; gy++) {
      const { sy } = camera.worldToScreen(0, gy, cellPx)
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(ctx.canvas.width, sy)
      ctx.stroke()
    }
    for (let gx = startX; gx <= endX; gx++) {
      const { sx } = camera.worldToScreen(gx, 0, cellPx)
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, ctx.canvas.height)
      ctx.stroke()
    }

    // Obstacles in viewport
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const obs = this.obstacleGrid.get(`${x},${y}`)
        if (!obs) continue

        const { sx, sy } = camera.worldToScreen(x, y, cellPx)
        ctx.fillStyle = OBSTACLE_COLORS[obs.type]
        ctx.fillRect(sx, sy, cellPx, cellPx)

        // Brick pattern
        if (obs.type === ObstacleType.Brick) {
          ctx.strokeStyle = '#A33A1D'
          ctx.lineWidth = 1
          ctx.strokeRect(sx + 1, sy + 1, cellPx - 2, cellPx - 2)
          ctx.beginPath()
          ctx.moveTo(sx, sy + cellPx / 2)
          ctx.lineTo(sx + cellPx, sy + cellPx / 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(sx + cellPx / 2, sy)
          ctx.lineTo(sx + cellPx / 2, sy + cellPx / 2)
          ctx.stroke()
        }

        // Steel shine
        if (obs.type === ObstacleType.Steel) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(sx + 2, sy + 2, cellPx / 3, cellPx / 3)
        }

        // Water wave pattern
        if (obs.type === ObstacleType.Water) {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)'
          ctx.lineWidth = 1
          const t = Date.now() / 500
          ctx.beginPath()
          ctx.moveTo(sx, sy + cellPx / 2 + Math.sin(t + x) * 2)
          ctx.lineTo(sx + cellPx, sy + cellPx / 2 + Math.sin(t + x + 1) * 2)
          ctx.stroke()
        }

        // Bush dots
        if (obs.type === ObstacleType.Bush) {
          ctx.fillStyle = '#40916C'
          const r = cellPx / 5
          for (let i = 0; i < 3; i++) {
            const bx = sx + cellPx * (0.25 + i * 0.25)
            const by = sy + cellPx * (0.3 + (i % 2) * 0.3)
            ctx.beginPath()
            ctx.arc(bx, by, r, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }
  }
}
