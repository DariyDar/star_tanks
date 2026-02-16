import type { Vec2 } from '@shared/types.js'
import { VIEWPORT_CELLS } from '@shared/constants.js'
import { clamp } from '@shared/math.js'

export class Camera {
  x = 0
  y = 0
  private mapWidth: number
  private mapHeight: number
  private initialized = false
  /** Viewport width in cells (updates each frame via setViewport) */
  viewportW = VIEWPORT_CELLS
  /** Viewport height in cells */
  viewportH = VIEWPORT_CELLS

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  /** Call each frame with canvas dimensions and cellPx to compute viewport in cells */
  setViewport(canvasW: number, canvasH: number, cellPx: number): void {
    this.viewportW = canvasW / cellPx
    this.viewportH = canvasH / cellPx
  }

  follow(target: Vec2): void {
    const halfW = this.viewportW / 2
    const halfH = this.viewportH / 2
    const targetX = clamp(target.x - halfW, 0, Math.max(0, this.mapWidth - this.viewportW))
    const targetY = clamp(target.y - halfH, 0, Math.max(0, this.mapHeight - this.viewportH))

    if (!this.initialized) {
      this.x = targetX
      this.y = targetY
      this.initialized = true
      return
    }

    // Smooth camera follow — lerp toward target
    const smoothing = 0.15
    this.x += (targetX - this.x) * smoothing
    this.y += (targetY - this.y) * smoothing
  }

  worldToScreen(wx: number, wy: number, cellPx: number): { sx: number; sy: number } {
    return {
      sx: (wx - this.x) * cellPx,
      sy: (wy - this.y) * cellPx
    }
  }

  isVisible(wx: number, wy: number): boolean {
    return (
      wx >= this.x - 1 && wx <= this.x + this.viewportW + 1 &&
      wy >= this.y - 1 && wy <= this.y + this.viewportH + 1
    )
  }
}
