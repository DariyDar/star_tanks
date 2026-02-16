import type { GameState, Tank } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

const MINIMAP_SIZE = 150
const MINIMAP_PADDING = 10
const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

export class MinimapRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    mapWidth: number,
    mapHeight: number,
    myId: string
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
