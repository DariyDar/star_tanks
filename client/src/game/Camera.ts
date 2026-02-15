import type { Vec2 } from '@shared/types.js'
import { VIEWPORT_CELLS } from '@shared/constants.js'
import { clamp } from '@shared/math.js'

export class Camera {
  x = 0
  y = 0
  private mapWidth: number
  private mapHeight: number
  private initialized = false

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  follow(target: Vec2): void {
    const viewportHalf = VIEWPORT_CELLS / 2
    const targetX = clamp(target.x - viewportHalf, 0, this.mapWidth - VIEWPORT_CELLS)
    const targetY = clamp(target.y - viewportHalf, 0, this.mapHeight - VIEWPORT_CELLS)

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
      wx >= this.x - 1 && wx <= this.x + VIEWPORT_CELLS + 1 &&
      wy >= this.y - 1 && wy <= this.y + VIEWPORT_CELLS + 1
    )
  }
}
