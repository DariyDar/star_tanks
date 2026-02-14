import type { Vec2 } from '@shared/types.js'
import { CELL_SIZE, VIEWPORT_CELLS } from '@shared/constants.js'
import { clamp } from '@shared/math.js'

export class Camera {
  x = 0
  y = 0
  private mapWidth: number
  private mapHeight: number

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  follow(target: Vec2): void {
    const viewportHalf = Math.floor(VIEWPORT_CELLS / 2)
    this.x = clamp(target.x - viewportHalf, 0, this.mapWidth - VIEWPORT_CELLS)
    this.y = clamp(target.y - viewportHalf, 0, this.mapHeight - VIEWPORT_CELLS)
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
