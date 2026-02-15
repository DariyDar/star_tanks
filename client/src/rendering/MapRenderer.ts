import { ObstacleType, type Obstacle } from '@shared/types.js'
import { VIEWPORT_CELLS } from '@shared/constants.js'
import type { Camera } from '../game/Camera.js'

const OBSTACLE_COLORS: Record<ObstacleType, string> = {
  [ObstacleType.Brick]: '#C84B31',
  [ObstacleType.Steel]: '#7F8487',
  [ObstacleType.Water]: '#1A73E8',
  [ObstacleType.Bush]: '#2D6A4F',
  [ObstacleType.Quicksand]: '#D4A574'
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

    // Obstacles in viewport with 3D effects
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const obs = this.obstacleGrid.get(`${x},${y}`)
        if (!obs) continue

        const { sx, sy } = camera.worldToScreen(x, y, cellPx)

        // 3D Brick with depth and texture
        if (obs.type === ObstacleType.Brick) {
          // Shadow (depth effect)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
          ctx.fillRect(sx + 2, sy + 2, cellPx, cellPx)

          // Gradient for 3D look
          const brickGrad = ctx.createLinearGradient(sx, sy, sx + cellPx, sy + cellPx)
          brickGrad.addColorStop(0, '#D85A3F')
          brickGrad.addColorStop(0.5, '#C84B31')
          brickGrad.addColorStop(1, '#A33A1D')

          ctx.fillStyle = brickGrad
          ctx.fillRect(sx, sy, cellPx, cellPx)

          // Mortar lines (dark edges)
          ctx.strokeStyle = '#8B2F1F'
          ctx.lineWidth = 2
          ctx.strokeRect(sx, sy, cellPx, cellPx)

          // Individual bricks
          ctx.strokeStyle = '#9A3520'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(sx, sy + cellPx / 2)
          ctx.lineTo(sx + cellPx, sy + cellPx / 2)
          ctx.stroke()

          // Vertical line (offset brick pattern)
          const offset = (y % 2) * (cellPx / 2)
          ctx.beginPath()
          ctx.moveTo(sx + cellPx / 2 + offset, sy)
          ctx.lineTo(sx + cellPx / 2 + offset, sy + cellPx / 2)
          ctx.stroke()

          // Highlight for 3D effect
          ctx.strokeStyle = 'rgba(255, 150, 100, 0.3)'
          ctx.lineWidth = 1
          ctx.strokeRect(sx + 1, sy + 1, 2, 2)

          // Damage cracks if HP is low
          if (obs.hp < 3) {
            ctx.strokeStyle = '#000'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(sx + cellPx * 0.3, sy + cellPx * 0.2)
            ctx.lineTo(sx + cellPx * 0.6, sy + cellPx * 0.5)
            ctx.lineTo(sx + cellPx * 0.7, sy + cellPx * 0.8)
            ctx.stroke()
          }
        }

        // 3D Steel with metallic shine
        if (obs.type === ObstacleType.Steel) {
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
          ctx.fillRect(sx + 2, sy + 2, cellPx, cellPx)

          // Metallic gradient
          const steelGrad = ctx.createLinearGradient(sx, sy, sx + cellPx, sy + cellPx)
          steelGrad.addColorStop(0, '#A0A5A8')
          steelGrad.addColorStop(0.3, '#7F8487')
          steelGrad.addColorStop(0.7, '#6A6E70')
          steelGrad.addColorStop(1, '#505458')

          ctx.fillStyle = steelGrad
          ctx.fillRect(sx, sy, cellPx, cellPx)

          // Beveled edges (3D effect)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.fillRect(sx, sy, cellPx, 2)
          ctx.fillRect(sx, sy, 2, cellPx)

          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
          ctx.fillRect(sx, sy + cellPx - 2, cellPx, 2)
          ctx.fillRect(sx + cellPx - 2, sy, 2, cellPx)

          // Metallic shine spots
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
          ctx.fillRect(sx + cellPx * 0.15, sy + cellPx * 0.15, cellPx * 0.25, cellPx * 0.25)

          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
          ctx.fillRect(sx + cellPx * 0.6, sy + cellPx * 0.5, cellPx * 0.3, cellPx * 0.3)

          // Rivets
          ctx.fillStyle = '#505458'
          const rivetR = cellPx * 0.08
          for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
              const rx = sx + cellPx * (0.2 + i * 0.6)
              const ry = sy + cellPx * (0.2 + j * 0.6)
              ctx.beginPath()
              ctx.arc(rx, ry, rivetR, 0, Math.PI * 2)
              ctx.fill()
              // Rivet highlight
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
              ctx.beginPath()
              ctx.arc(rx - rivetR * 0.3, ry - rivetR * 0.3, rivetR * 0.4, 0, Math.PI * 2)
              ctx.fill()
              ctx.fillStyle = '#505458'
            }
          }
        }

        // 3D Water with animated waves and reflections
        if (obs.type === ObstacleType.Water) {
          const t = Date.now() / 800

          // Base water with gradient
          const waterGrad = ctx.createLinearGradient(sx, sy, sx, sy + cellPx)
          waterGrad.addColorStop(0, '#2A8CFF')
          waterGrad.addColorStop(0.5, '#1A73E8')
          waterGrad.addColorStop(1, '#0D5BBF')

          ctx.fillStyle = waterGrad
          ctx.fillRect(sx, sy, cellPx, cellPx)

          // Animated waves (multiple layers)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
          ctx.lineWidth = 1.5
          for (let w = 0; w < 2; w++) {
            ctx.beginPath()
            for (let i = 0; i <= cellPx; i += 2) {
              const wave = Math.sin((t + x + y + i / 10 + w * 0.5) * 2) * 1.5
              if (i === 0) ctx.moveTo(sx + i, sy + cellPx * (0.3 + w * 0.3) + wave)
              else ctx.lineTo(sx + i, sy + cellPx * (0.3 + w * 0.3) + wave)
            }
            ctx.stroke()
          }

          // Light reflection spots
          ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.sin(t + x) * 0.1})`
          ctx.beginPath()
          ctx.arc(sx + cellPx * 0.3, sy + cellPx * 0.4, cellPx * 0.15, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.sin(t + y) * 0.08})`
          ctx.beginPath()
          ctx.arc(sx + cellPx * 0.7, sy + cellPx * 0.6, cellPx * 0.12, 0, Math.PI * 2)
          ctx.fill()
        }

        // 3D Bush with depth
        if (obs.type === ObstacleType.Bush) {
          // Bush clusters with radial gradients
          const clusters = [
            { x: 0.25, y: 0.3, r: 0.22 },
            { x: 0.55, y: 0.35, r: 0.25 },
            { x: 0.7, y: 0.6, r: 0.2 },
            { x: 0.3, y: 0.65, r: 0.23 }
          ]

          for (const cluster of clusters) {
            const bx = sx + cellPx * cluster.x
            const by = sy + cellPx * cluster.y
            const r = cellPx * cluster.r

            // Shadow under bush
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
            ctx.beginPath()
            ctx.arc(bx + r * 0.2, by + r * 0.2, r, 0, Math.PI * 2)
            ctx.fill()

            // Bush gradient (3D sphere)
            const bushGrad = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 0, bx, by, r)
            bushGrad.addColorStop(0, '#52B788')
            bushGrad.addColorStop(0.5, '#40916C')
            bushGrad.addColorStop(1, '#2D6A4F')

            ctx.fillStyle = bushGrad
            ctx.beginPath()
            ctx.arc(bx, by, r, 0, Math.PI * 2)
            ctx.fill()

            // Highlight
            ctx.fillStyle = 'rgba(130, 220, 150, 0.4)'
            ctx.beginPath()
            ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.4, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // 3D Quicksand with flowing texture
        if (obs.type === ObstacleType.Quicksand) {
          const t = Date.now() / 1500

          // Base quicksand with gradient
          const sandGrad = ctx.createRadialGradient(
            sx + cellPx / 2, sy + cellPx / 2, 0,
            sx + cellPx / 2, sy + cellPx / 2, cellPx * 0.8
          )
          sandGrad.addColorStop(0, '#E8C896')
          sandGrad.addColorStop(0.5, '#D4A574')
          sandGrad.addColorStop(1, '#B8875C')

          ctx.fillStyle = sandGrad
          ctx.fillRect(sx, sy, cellPx, cellPx)

          // Swirling pattern (animated)
          ctx.strokeStyle = 'rgba(160, 120, 80, 0.3)'
          ctx.lineWidth = 1.5
          for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            const angleOffset = t + i * Math.PI / 1.5
            const radius = cellPx * (0.2 + i * 0.1)
            for (let a = 0; a < Math.PI * 2; a += 0.3) {
              const rx = sx + cellPx / 2 + Math.cos(a + angleOffset) * radius
              const ry = sy + cellPx / 2 + Math.sin(a + angleOffset) * radius
              if (a === 0) ctx.moveTo(rx, ry)
              else ctx.lineTo(rx, ry)
            }
            ctx.closePath()
            ctx.stroke()
          }

          // Dark center (sinking point)
          const centerGrad = ctx.createRadialGradient(
            sx + cellPx / 2, sy + cellPx / 2, 0,
            sx + cellPx / 2, sy + cellPx / 2, cellPx * 0.15
          )
          centerGrad.addColorStop(0, 'rgba(80, 60, 40, 0.6)')
          centerGrad.addColorStop(1, 'rgba(80, 60, 40, 0)')

          ctx.fillStyle = centerGrad
          ctx.beginPath()
          ctx.arc(sx + cellPx / 2, sy + cellPx / 2, cellPx * 0.2, 0, Math.PI * 2)
          ctx.fill()

          // Ripple effect
          const ripple = Math.sin(t * 2) * 0.1
          ctx.strokeStyle = `rgba(200, 160, 120, ${0.2 + ripple})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(sx + cellPx / 2, sy + cellPx / 2, cellPx * (0.35 + ripple), 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
  }
}
