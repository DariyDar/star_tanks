import type { Tank, Star, PowerUp, Portal, Zone, Vec2 } from '@tank-br/shared/types.js'
import { distance, vecToAngle } from '@tank-br/shared/math.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'
import { findPath } from './Pathfinding.js'

type BotState = 'patrol' | 'chase' | 'fleeZone'

export interface BotMoveResult {
  moveAngle: number | null
  aimAngle: number
}

interface BotData {
  state: BotState
  path: Vec2[]
  pathRecalcAt: number
  targetId: string | null
  lastAimAngle: number
}

const RECALC_INTERVAL = 500
const CHASE_RANGE = 15
const ZONE_MARGIN = 10
const MAX_BOTS_PER_RICH_TARGET = 3
const RICH_TARGET_RANGE = 30

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
      targetId: null,
      lastAimAngle: 0
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
  ): Map<string, BotMoveResult> {
    const moves = new Map<string, BotMoveResult>()

    const players = tanks.filter(t => t.isAlive && !t.isBot)
    const richestPlayer = players.length > 0
      ? players.reduce((richest, player) => player.stars > richest.stars ? player : richest)
      : null

    let botsTargetingRichest = 0
    if (richestPlayer) {
      for (const data of this.bots.values()) {
        if (data.targetId === richestPlayer.id) {
          botsTargetingRichest++
        }
      }
    }

    for (const tank of tanks) {
      if (!tank.isBot || !tank.isAlive) continue

      let data = this.bots.get(tank.id)
      if (!data) {
        this.registerBot(tank.id)
        data = this.bots.get(tank.id)!
      }

      const moveAngle = this.updateBot(tank, data, tanks, stars, powerUps, zone, now, richestPlayer, botsTargetingRichest)
      const aimAngle = this.calculateAimAngle(tank, data, tanks)

      data.lastAimAngle = aimAngle
      moves.set(tank.id, { moveAngle, aimAngle })

      if (richestPlayer && data.targetId === richestPlayer.id && data.state === 'chase') {
        botsTargetingRichest++
      }
    }

    return moves
  }

  private calculateAimAngle(tank: Tank, data: BotData, tanks: Tank[]): number {
    // Aim at the closest enemy (prefer players over bots)
    let bestTarget: Tank | null = null
    let bestDistSq = Infinity

    for (const other of tanks) {
      if (!other.isAlive || other.id === tank.id) continue
      if (other.isBot) continue // Prefer aiming at players

      const dx = other.position.x - tank.position.x
      const dy = other.position.y - tank.position.y
      const distSq = dx * dx + dy * dy

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestTarget = other
      }
    }

    // Fallback: aim at any alive non-self tank
    if (!bestTarget) {
      for (const other of tanks) {
        if (!other.isAlive || other.id === tank.id) continue
        const dx = other.position.x - tank.position.x
        const dy = other.position.y - tank.position.y
        const distSq = dx * dx + dy * dy

        if (distSq < bestDistSq) {
          bestDistSq = distSq
          bestTarget = other
        }
      }
    }

    if (bestTarget) {
      const dx = bestTarget.position.x - tank.position.x
      const dy = bestTarget.position.y - tank.position.y
      return vecToAngle(dx, dy)
    }

    // No target — aim in movement direction or keep last aim
    return data.lastAimAngle
  }

  private updateBot(
    tank: Tank,
    data: BotData,
    tanks: Tank[],
    stars: Star[],
    powerUps: PowerUp[],
    zone: Zone,
    now: number,
    richestPlayer: Tank | null,
    botsTargetingRichest: number
  ): number | null {
    // Priority 1: Flee zone
    const distToCenter = distance(tank.position, { x: zone.centerX, y: zone.centerY })
    if (distToCenter > zone.currentRadius - ZONE_MARGIN) {
      data.state = 'fleeZone'
      return this.moveToward(tank, data, { x: zone.centerX, y: zone.centerY }, now)
    }

    // Priority 2: Coordinated aggression on richest player
    if (richestPlayer && richestPlayer.stars >= 5) {
      const distToRichest = distance(tank.position, richestPlayer.position)

      if ((data.targetId === richestPlayer.id) ||
          (botsTargetingRichest < MAX_BOTS_PER_RICH_TARGET && distToRichest < RICH_TARGET_RANGE)) {
        data.state = 'chase'
        data.targetId = richestPlayer.id
        return this.moveToward(tank, data, richestPlayer.position, now)
      }
    }

    // Priority 3: Chase nearby players
    const enemies = tanks.filter(t =>
      t.isAlive && t.id !== tank.id && !t.isBot &&
      distance(tank.position, t.position) < CHASE_RANGE
    )
    if (enemies.length > 0) {
      const sorted = enemies.sort((a, b) => b.stars - a.stars)
      const target = sorted[0]
      data.state = 'chase'
      data.targetId = target.id
      return this.moveToward(tank, data, target.position, now)
    }

    // Priority 4: Patrol
    data.state = 'patrol'
    data.targetId = null
    return this.patrol(tank, data, now)
  }

  private moveToward(tank: Tank, data: BotData, target: Vec2, now: number): number | null {
    if (now - data.pathRecalcAt > RECALC_INTERVAL || data.path.length === 0) {
      data.path = findPath(tank.position, target, this.grid, this.mapWidth, this.mapHeight)
      data.pathRecalcAt = now
    }

    if (data.path.length === 0) {
      const dx = target.x - tank.position.x
      const dy = target.y - tank.position.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null
      return vecToAngle(dx, dy)
    }

    const next = data.path[0]
    const dx = next.x - tank.position.x
    const dy = next.y - tank.position.y

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      data.path.shift()
      return data.path.length > 0 ? this.moveToward(tank, data, target, now) : null
    }

    return vecToAngle(dx, dy)
  }

  private patrol(tank: Tank, data: BotData, now: number): number | null {
    if (data.path.length === 0 || now - data.pathRecalcAt > 2000) {
      const targetX = Math.floor(Math.random() * (this.mapWidth - 40)) + 20
      const targetY = Math.floor(Math.random() * (this.mapHeight - 40)) + 20
      data.path = findPath(tank.position, { x: targetX, y: targetY }, this.grid, this.mapWidth, this.mapHeight)
      data.pathRecalcAt = now
    }

    if (data.path.length === 0) {
      // Random angle
      return Math.random() * 2 * Math.PI - Math.PI
    }

    const next = data.path[0]
    const dx = next.x - tank.position.x
    const dy = next.y - tank.position.y

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      data.path.shift()
      return null
    }

    return vecToAngle(dx, dy)
  }
}
