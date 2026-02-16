import type { GameState, Tank } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

const MINIMAP_SIZE = 150
const MINIMAP_PADDING = 10

export class MinimapRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    mapWidth: number,
    mapHeight: number,
    myId: string
  ): void {
    const canvasW = ctx.canvas.width
    const canvasH = ctx.canvas.height
    const mx = canvasW - MINIMAP_SIZE - MINIMAP_PADDING
    const my = canvasH - MINIMAP_SIZE - MINIMAP_PADDING

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)

    // Border
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.strokeRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)

    const scaleX = MINIMAP_SIZE / mapWidth
    const scaleY = MINIMAP_SIZE / mapHeight

    // Zone circle
    if (state.zone.currentRadius < Math.max(mapWidth, mapHeight)) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)
      ctx.clip()

      // Danger zone (outside circle is red)
      ctx.fillStyle = 'rgba(255,0,0,0.3)'
      ctx.fillRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE)

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
    for (const tank of state.tanks) {
      if (!tank.isAlive) continue
      const px = mx + tank.position.x * scaleX
      const py = my + tank.position.y * scaleY

      if (tank.id === myId) {
        ctx.fillStyle = '#FFF'
        ctx.fillRect(px - 2, py - 2, 5, 5)
      } else if (tank.isBot) {
        ctx.fillStyle = '#FF4444'
        ctx.fillRect(px - 1, py - 1, 3, 3)
      } else {
        ctx.fillStyle = '#44FF44'
        ctx.fillRect(px - 1, py - 1, 3, 3)
      }
    }

    // Stars as yellow dots
    for (const star of state.stars) {
      if (!star.active) continue
      const px = mx + star.position.x * scaleX
      const py = my + star.position.y * scaleY
      ctx.fillStyle = '#FFD700'
      ctx.fillRect(px, py, 2, 2)
    }

    // Portals as blue dots
    for (const portal of state.portals) {
      const px = mx + portal.position.x * scaleX
      const py = my + portal.position.y * scaleY
      ctx.fillStyle = '#00FFFF'
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
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
