import type { Tank, Star, PowerUp, Portal, Zone, Vec2 } from '@tank-br/shared/types.js'
import { Direction } from '@tank-br/shared/types.js'
import { distance, vecToDirection } from '@tank-br/shared/math.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'
import { findPath } from './Pathfinding.js'

type BotState = 'patrol' | 'chase' | 'collect' | 'fleeZone'

interface BotData {
  state: BotState
  path: Vec2[]
  pathRecalcAt: number
  targetId: string | null
}

const RECALC_INTERVAL = 500
const CHASE_RANGE = 15
const POWERUP_RANGE = 20
const STAR_RANGE = 30
const ZONE_MARGIN = 50

export class BotController {
  private bots = new Map<string, BotData>()

  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  registerBot(botId: string): void {
    this.bots.set(botId, {
      state: 'patrol',
      path: [],
      pathRecalcAt: 0,
      targetId: null
    })
  }

  unregisterBot(botId: string): void {
    this.bots.delete(botId)
  }

  update(
    tanks: Tank[],
    stars: Star[],
    powerUps: PowerUp[],
    portals: Portal[],
    zone: Zone,
    now: number
  ): Map<string, Direction | null> {
    const moves = new Map<string, Direction | null>()

    for (const tank of tanks) {
      if (!tank.isBot || !tank.isAlive) continue

      let data = this.bots.get(tank.id)
      if (!data) {
        this.registerBot(tank.id)
        data = this.bots.get(tank.id)!
      }

      const move = this.updateBot(tank, data, tanks, stars, powerUps, zone, now)
      moves.set(tank.id, move)
    }

    return moves
  }

  private updateBot(
    tank: Tank,
    data: BotData,
    tanks: Tank[],
    stars: Star[],
    powerUps: PowerUp[],
    zone: Zone,
    now: number
  ): Direction | null {
    // Priority 1: Flee zone
    const distToCenter = distance(tank.position, { x: zone.centerX, y: zone.centerY })
    if (distToCenter > zone.currentRadius - ZONE_MARGIN) {
      data.state = 'fleeZone'
      return this.moveToward(tank, data, { x: zone.centerX, y: zone.centerY }, now)
    }

    // Priority 2: Chase nearby enemy
    const enemies = tanks.filter(t =>
      t.isAlive && t.id !== tank.id &&
      distance(tank.position, t.position) < CHASE_RANGE
    )
    if (enemies.length > 0) {
      const closest = enemies.reduce((a, b) =>
        distance(tank.position, a.position) < distance(tank.position, b.position) ? a : b
      )
      data.state = 'chase'
      data.targetId = closest.id
      return this.moveToward(tank, data, closest.position, now)
    }

    // Priority 3: Collect nearby power-up
    const nearPU = powerUps.find(pu =>
      distance(tank.position, pu.position) < POWERUP_RANGE
    )
    if (nearPU) {
      data.state = 'collect'
      return this.moveToward(tank, data, nearPU.position, now)
    }

    // Priority 4: Collect nearby star
    const nearStar = stars.find(s =>
      s.active && distance(tank.position, s.position) < STAR_RANGE
    )
    if (nearStar) {
      data.state = 'collect'
      return this.moveToward(tank, data, nearStar.position, now)
    }

    // Priority 5: Patrol
    data.state = 'patrol'
    return this.patrol(tank, data, now)
  }

  private moveToward(tank: Tank, data: BotData, target: Vec2, now: number): Direction | null {
    // Recalculate path periodically
    if (now - data.pathRecalcAt > RECALC_INTERVAL || data.path.length === 0) {
      data.path = findPath(tank.position, target, this.grid, this.mapWidth, this.mapHeight)
      data.pathRecalcAt = now
    }

    if (data.path.length === 0) {
      // Direct approach if no path
      const dx = target.x - tank.position.x
      const dy = target.y - tank.position.y
      return vecToDirection(dx, dy)
    }

    const next = data.path[0]
    const dx = next.x - Math.round(tank.position.x)
    const dy = next.y - Math.round(tank.position.y)

    if (dx === 0 && dy === 0) {
      data.path.shift()
      return data.path.length > 0 ? this.moveToward(tank, data, target, now) : null
    }

    return vecToDirection(dx, dy)
  }

  private patrol(tank: Tank, data: BotData, now: number): Direction | null {
    // Set a random target if no path
    if (data.path.length === 0 || now - data.pathRecalcAt > 3000) {
      const targetX = Math.floor(Math.random() * (this.mapWidth - 200)) + 100
      const targetY = Math.floor(Math.random() * (this.mapHeight - 200)) + 100
      data.path = findPath(tank.position, { x: targetX, y: targetY }, this.grid, this.mapWidth, this.mapHeight)
      data.pathRecalcAt = now
    }

    if (data.path.length === 0) {
      // Wander randomly
      const dirs = [Direction.Up, Direction.Down, Direction.Left, Direction.Right]
      return dirs[Math.floor(Math.random() * dirs.length)]
    }

    const next = data.path[0]
    const dx = next.x - Math.round(tank.position.x)
    const dy = next.y - Math.round(tank.position.y)

    if (dx === 0 && dy === 0) {
      data.path.shift()
      return null
    }

    return vecToDirection(dx, dy)
  }
}
