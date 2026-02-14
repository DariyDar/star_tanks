import {
  type Tank, type Vec2, Direction, ObstacleType
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

    const clampedX = clamp(Math.round(newX), 0, this.mapWidth - 1)
    const clampedY = clamp(Math.round(newY), 0, this.mapHeight - 1)

    if (this.canMoveTo(clampedX, clampedY)) {
      tank.position = { x: clampedX, y: clampedY }
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    const obs = this.grid.getAt(x, y)
    if (!obs) return true
    return !isBlockingMovement(obs.type)
  }

  isPositionFree(pos: Vec2): boolean {
    return this.canMoveTo(pos.x, pos.y)
  }
}
