import {
  type Tank, type Vec2, Direction
} from '@tank-br/shared/types.js'
import {
  directionToVec, clamp
} from '@tank-br/shared/math.js'
import {
  SpatialGrid, isBlockingMovement
} from '@tank-br/shared/collision.js'
import { TICK_MS } from '@tank-br/shared/constants.js'

export class PhysicsEngine {
  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  moveTank(tank: Tank, moveDirection: Direction | null): void {
    if (!tank.isAlive || !moveDirection) return

    tank.direction = moveDirection

    const vec = directionToVec(moveDirection)
    const cellsPerTick = tank.speed * (TICK_MS / 1000)

    const newX = tank.position.x + vec.x * cellsPerTick
    const newY = tank.position.y + vec.y * cellsPerTick

    // Check the target integer cell in the movement direction
    const targetCellX = vec.x > 0 ? Math.ceil(newX) : vec.x < 0 ? Math.floor(newX) : Math.round(newX)
    const targetCellY = vec.y > 0 ? Math.ceil(newY) : vec.y < 0 ? Math.floor(newY) : Math.round(newY)

    const clampedTargetX = clamp(targetCellX, 0, this.mapWidth - 1)
    const clampedTargetY = clamp(targetCellY, 0, this.mapHeight - 1)

    if (this.canMoveTo(clampedTargetX, clampedTargetY)) {
      // Move smoothly — keep float position
      tank.position = {
        x: clamp(newX, 0, this.mapWidth - 1),
        y: clamp(newY, 0, this.mapHeight - 1)
      }
    } else {
      // Can't move to target cell — snap to the nearest integer boundary
      tank.position = {
        x: Math.round(tank.position.x),
        y: Math.round(tank.position.y)
      }
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    const obs = this.grid.getAt(x, y)
    if (!obs) return true
    return !isBlockingMovement(obs.type)
  }

  isPositionFree(pos: Vec2): boolean {
    return this.canMoveTo(Math.round(pos.x), Math.round(pos.y))
  }
}
