import type { Zone } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

export class ZoneRenderer {
  render(ctx: CanvasRenderingContext2D, zone: Zone, camera: Camera, cellPx: number): void {
    const maxRadius = Math.max(zone.centerX, zone.centerY) * 2
    if (zone.currentRadius >= maxRadius) return

    const { sx: centerSx, sy: centerSy } = camera.worldToScreen(zone.centerX, zone.centerY, cellPx)
    const radiusPx = zone.currentRadius * cellPx

    ctx.save()

    // Red overlay outside zone circle
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'
    ctx.beginPath()
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.arc(centerSx, centerSy, radiusPx, 0, Math.PI * 2, true)
    ctx.fill()

    // Zone border
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 5])
    ctx.beginPath()
    ctx.arc(centerSx, centerSy, radiusPx, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()
  }
}
