import {
  type Tank, type Vec2
} from '@tank-br/shared/types.js'
import {
  angleToVec, clamp
} from '@tank-br/shared/math.js'
import {
  SpatialGrid, isBlockingMovement
} from '@tank-br/shared/collision.js'
import { TICK_MS, TANK_RADIUS } from '@tank-br/shared/constants.js'

const TANK_DIAMETER_SQ = (TANK_RADIUS * 2) * (TANK_RADIUS * 2)

export class PhysicsEngine {
  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  moveTank(tank: Tank, moveAngle: number | null, allTanks: Tank[]): void {
    if (!tank.isAlive || moveAngle === null) return

    tank.hullAngle = moveAngle

    const vec = angleToVec(moveAngle)
    const cellsPerTick = tank.speed * (TICK_MS / 1000)

    const dx = vec.x * cellsPerTick
    const dy = vec.y * cellsPerTick

    let newX = tank.position.x + dx
    let newY = tank.position.y + dy

    // Clamp to map bounds (with radius offset)
    newX = clamp(newX, TANK_RADIUS, this.mapWidth - 1 - TANK_RADIUS)
    newY = clamp(newY, TANK_RADIUS, this.mapHeight - 1 - TANK_RADIUS)

    // Try full movement first
    if (!this.collidesWithObstacle(newX, newY) && !this.collidesWithTank(newX, newY, tank.id, allTanks)) {
      tank.position = { x: newX, y: newY }
      return
    }

    // Wall sliding: try X-only
    const slideX = tank.position.x + dx
    const clampedSlideX = clamp(slideX, TANK_RADIUS, this.mapWidth - 1 - TANK_RADIUS)
    if (!this.collidesWithObstacle(clampedSlideX, tank.position.y) &&
        !this.collidesWithTank(clampedSlideX, tank.position.y, tank.id, allTanks)) {
      tank.position = { x: clampedSlideX, y: tank.position.y }
      return
    }

    // Wall sliding: try Y-only
    const slideY = tank.position.y + dy
    const clampedSlideY = clamp(slideY, TANK_RADIUS, this.mapHeight - 1 - TANK_RADIUS)
    if (!this.collidesWithObstacle(tank.position.x, clampedSlideY) &&
        !this.collidesWithTank(tank.position.x, clampedSlideY, tank.id, allTanks)) {
      tank.position = { x: tank.position.x, y: clampedSlideY }
      return
    }

    // Fully blocked — don't move
  }

  private collidesWithObstacle(cx: number, cy: number): boolean {
    // Check all cells in the bounding box of the tank circle
    const minX = Math.floor(cx - TANK_RADIUS)
    const maxX = Math.floor(cx + TANK_RADIUS)
    const minY = Math.floor(cy - TANK_RADIUS)
    const maxY = Math.floor(cy + TANK_RADIUS)

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const obs = this.grid.getAt(gx, gy)
        if (!obs || !isBlockingMovement(obs.type)) continue

        // Circle vs AABB: find closest point on cell [gx, gy]-[gx+1, gy+1] to circle center
        const closestX = clamp(cx, gx, gx + 1)
        const closestY = clamp(cy, gy, gy + 1)

        const distX = cx - closestX
        const distY = cy - closestY

        if (distX * distX + distY * distY < TANK_RADIUS * TANK_RADIUS) {
          return true
        }
      }
    }

    return false
  }

  private collidesWithTank(x: number, y: number, selfId: string, allTanks: Tank[]): boolean {
    for (const other of allTanks) {
      if (other.id === selfId || !other.isAlive) continue
      const dx = x - other.position.x
      const dy = y - other.position.y
      if (dx * dx + dy * dy < TANK_DIAMETER_SQ) {
        return true
      }
    }
    return false
  }

  isPositionFree(pos: Vec2): boolean {
    return !this.collidesWithObstacle(pos.x, pos.y)
  }
}
