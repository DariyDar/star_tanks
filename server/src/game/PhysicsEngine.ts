import {
  type Tank, type Vec2, ObstacleType
} from '@tank-br/shared/types.js'
import {
  angleToVec, clamp
} from '@tank-br/shared/math.js'
import {
  SpatialGrid, isBlockingMovement
} from '@tank-br/shared/collision.js'
import { TICK_MS, TANK_SPEED, BOT_SPEED } from '@tank-br/shared/constants.js'

export class PhysicsEngine {
  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  moveTank(tank: Tank, moveAngle: number | null, allTanks: Tank[], now: number): void {
    if (!tank.isAlive || moveAngle === null) return

    tank.hullAngle = moveAngle

    const vec = angleToVec(moveAngle)
    // Flag carriers move 30% slower
    const effectiveSpeed = tank.hasFlag ? tank.speed * 0.7 : tank.speed
    const cellsPerTick = effectiveSpeed * (TICK_MS / 1000)

    const dx = vec.x * cellsPerTick
    const dy = vec.y * cellsPerTick

    let newX = tank.position.x + dx
    let newY = tank.position.y + dy

    const radius = tank.tankRadius

    // Clamp to map bounds (with radius offset)
    newX = clamp(newX, radius, this.mapWidth - 1 - radius)
    newY = clamp(newY, radius, this.mapHeight - 1 - radius)

    // Try full movement first
    if (!this.collidesWithObstacle(newX, newY, radius) && !this.collidesWithTank(newX, newY, tank.id, allTanks)) {
      tank.position = { x: newX, y: newY }
      this.updateTerrainEffects(tank, now)
      return
    }

    // Wall sliding: try X-only
    const slideX = tank.position.x + dx
    const clampedSlideX = clamp(slideX, radius, this.mapWidth - 1 - radius)
    if (!this.collidesWithObstacle(clampedSlideX, tank.position.y, radius) &&
        !this.collidesWithTank(clampedSlideX, tank.position.y, tank.id, allTanks)) {
      tank.position = { x: clampedSlideX, y: tank.position.y }
      this.updateTerrainEffects(tank, now)
      return
    }

    // Wall sliding: try Y-only
    const slideY = tank.position.y + dy
    const clampedSlideY = clamp(slideY, radius, this.mapHeight - 1 - radius)
    if (!this.collidesWithObstacle(tank.position.x, clampedSlideY, radius) &&
        !this.collidesWithTank(tank.position.x, clampedSlideY, tank.id, allTanks)) {
      tank.position = { x: tank.position.x, y: clampedSlideY }
      this.updateTerrainEffects(tank, now)
      return
    }

    // Fully blocked — don't move
    // Still update terrain effects even if not moving
    this.updateTerrainEffects(tank, now)
  }

  private collidesWithObstacle(cx: number, cy: number, radius: number): boolean {
    // Check all cells in the bounding box of the tank circle
    const minX = Math.floor(cx - radius)
    const maxX = Math.floor(cx + radius)
    const minY = Math.floor(cy - radius)
    const maxY = Math.floor(cy + radius)

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const obs = this.grid.getAt(gx, gy)
        if (!obs || !isBlockingMovement(obs.type)) continue

        // Circle vs AABB: find closest point on cell [gx, gy]-[gx+1, gy+1] to circle center
        const closestX = clamp(cx, gx, gx + 1)
        const closestY = clamp(cy, gy, gy + 1)

        const distX = cx - closestX
        const distY = cy - closestY

        if (distX * distX + distY * distY < radius * radius) {
          return true
        }
      }
    }

    return false
  }

  private collidesWithTank(x: number, y: number, selfId: string, allTanks: Tank[]): boolean {
    const self = allTanks.find(t => t.id === selfId)
    if (!self) return false

    const selfRadius = self.tankRadius

    for (const other of allTanks) {
      if (other.id === selfId || !other.isAlive) continue
      const dx = x - other.position.x
      const dy = y - other.position.y
      const minDist = selfRadius + other.tankRadius
      if (dx * dx + dy * dy < minDist * minDist) {
        return true
      }
    }
    return false
  }

  private updateTerrainEffects(tank: Tank, now: number): void {
    // Check what terrain the tank is on
    const x = Math.floor(tank.position.x)
    const y = Math.floor(tank.position.y)
    const obs = this.grid.getAt(x, y)

    // Check if in bush (for stealth)
    tank.inBush = obs?.type === ObstacleType.Bush

    // Check if in quicksand (for slow effect)
    if (obs?.type === ObstacleType.Quicksand) {
      // Apply slow effect for 10 seconds
      if (now > tank.quicksandSlowEndTime) {
        tank.quicksandSlowEndTime = now + 10000
      }
    }

    // Apply or remove slow effect
    if (now < tank.quicksandSlowEndTime) {
      // Slow down by 1.5x
      const baseSpeed = tank.isBot ? BOT_SPEED : TANK_SPEED
      const slowedSpeed = baseSpeed / 1.5
      // Only slow if not already slowed by quicksand
      if (tank.speed >= baseSpeed * 0.9) {
        tank.speed = slowedSpeed
      }
    } else if (tank.quicksandSlowEndTime > 0) {
      // Restore speed when slow effect ends
      const baseSpeed = tank.isBot ? BOT_SPEED : TANK_SPEED
      // Only restore if not affected by speed powerup
      if (tank.activePowerUp !== 'speed') {
        tank.speed = baseSpeed
      }
      tank.quicksandSlowEndTime = 0
    }
  }

  isPositionFree(pos: Vec2, radius = 0.45): boolean {
    return !this.collidesWithObstacle(pos.x, pos.y, radius)
  }
}
