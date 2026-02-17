import type { GameState, Obstacle } from '@shared/types.js'
import { ObstacleType } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

const MINIMAP_SIZE = 150
const MINIMAP_PADDING = 10
const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

export class MinimapRenderer {
  // Pre-rendered obstacle layer (regenerated when obstacles change)
  private obstacleCanvas: OffscreenCanvas | null = null
  private obstacleCount = -1

  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    mapWidth: number,
    mapHeight: number,
    myId: string,
    obstacles?: Obstacle[]
  ): void {
    const s = isMobile ? 1.3 : 1
    const size = Math.round(MINIMAP_SIZE * s)
    const pad = Math.round(MINIMAP_PADDING * s)
    const canvasW = ctx.canvas.width
    const canvasH = ctx.canvas.height
    const mx = canvasW - size - pad
    const my = canvasH - size - pad

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(mx, my, size, size)

    // Border
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.strokeRect(mx, my, size, size)

    const scaleX = size / mapWidth
    const scaleY = size / mapHeight

    // Obstacles (pre-rendered to offscreen canvas for performance)
    if (obstacles && obstacles.length > 0) {
      if (!this.obstacleCanvas || this.obstacleCount !== obstacles.length) {
        this.obstacleCanvas = new OffscreenCanvas(size, size)
        this.obstacleCount = obstacles.length
        const oCtx = this.obstacleCanvas.getContext('2d')!

        // Each obstacle cell is tiny on minimap, so we batch by type
        const colors: Partial<Record<string, string>> = {
          [ObstacleType.Brick]: 'rgba(160, 120, 80, 0.7)',
          [ObstacleType.Steel]: 'rgba(180, 180, 190, 0.8)',
          [ObstacleType.Water]: 'rgba(40, 100, 200, 0.5)',
          [ObstacleType.Bush]: 'rgba(40, 130, 40, 0.4)',
          [ObstacleType.Quicksand]: 'rgba(180, 160, 80, 0.4)'
        }

        // Draw obstacles grouped by type for fewer fillStyle changes
        for (const type of [ObstacleType.Steel, ObstacleType.Brick, ObstacleType.Water, ObstacleType.Quicksand, ObstacleType.Bush]) {
          oCtx.fillStyle = colors[type] ?? 'rgba(128,128,128,0.5)'
          for (const obs of obstacles) {
            if (obs.type !== type) continue
            const px = obs.x * scaleX
            const py = obs.y * scaleY
            // Draw at least 1px, but scale up for visibility
            const w = Math.max(1, Math.ceil(scaleX))
            const h = Math.max(1, Math.ceil(scaleY))
            oCtx.fillRect(px, py, w, h)
          }
        }
      }
      ctx.drawImage(this.obstacleCanvas, mx, my)
    }

    // Zone circle
    if (state.zone.currentRadius < Math.max(mapWidth, mapHeight)) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(mx, my, size, size)
      ctx.clip()

      // Danger zone (outside circle is red)
      ctx.fillStyle = 'rgba(255,0,0,0.3)'
      ctx.fillRect(mx, my, size, size)

      // Safe zone (inside circle is clear)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(
        mx + state.zone.centerX * scaleX,
        my + state.zone.centerY * scaleY,
        state.zone.currentRadius * Math.min(scaleX, scaleY),
        0, Math.PI * 2
      )
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      ctx.restore()
    }

    // Tanks as dots
    const dotS = Math.round(3 * s)
    const dotL = Math.round(5 * s)
    for (const tank of state.tanks) {
      if (!tank.isAlive) continue
      const px = mx + tank.position.x * scaleX
      const py = my + tank.position.y * scaleY

      if (tank.id === myId) {
        ctx.fillStyle = '#FFF'
        ctx.fillRect(px - dotL / 2, py - dotL / 2, dotL, dotL)
      } else if (tank.isBot) {
        ctx.fillStyle = '#FF4444'
        ctx.fillRect(px - dotS / 2, py - dotS / 2, dotS, dotS)
      } else {
        ctx.fillStyle = '#44FF44'
        ctx.fillRect(px - dotS / 2, py - dotS / 2, dotS, dotS)
      }
    }

    // Stars as yellow dots
    for (const star of state.stars) {
      if (!star.active) continue
      const px = mx + star.position.x * scaleX
      const py = my + star.position.y * scaleY
      ctx.fillStyle = '#FFD700'
      ctx.fillRect(px, py, Math.round(2 * s), Math.round(2 * s))
    }

    // Portals as blue dots
    for (const portal of state.portals) {
      const px = mx + portal.position.x * scaleX
      const py = my + portal.position.y * scaleY
      ctx.fillStyle = '#00FFFF'
      ctx.beginPath()
      ctx.arc(px, py, Math.round(3 * s), 0, Math.PI * 2)
      ctx.fill()
    }

    // Viewport rect
    ctx.strokeStyle = '#FFF'
    ctx.lineWidth = 1
    ctx.strokeRect(
      mx + camera.x * scaleX,
      my + camera.y * scaleY,
      camera.viewportW * scaleX,
      camera.viewportH * scaleY
    )
  }
}
