import type { Tank, Star, PowerUp, Portal, Zone, Vec2 } from '@tank-br/shared/types.js'
import { distance, vecToAngle } from '@tank-br/shared/math.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'

export interface BotMoveResult {
  moveAngle: number | null
  aimAngle: number
}

interface BotData {
  patrolTarget: Vec2 | null
  lastRetarget: number
  lastAimAngle: number
}

const CHASE_RANGE = 20  // Range to detect and chase players
const ZONE_MARGIN = 10  // Distance from zone edge before fleeing
const RETARGET_INTERVAL = 3000  // Retarget patrol every 3 seconds
const MIN_PATROL_DISTANCE = 30  // Minimum distance for patrol targets

export class BotController {
  private bots = new Map<string, BotData>()

  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  registerBot(botId: string): void {
    this.bots.set(botId, {
      patrolTarget: null,
      lastRetarget: 0,
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

    for (const tank of tanks) {
      if (!tank.isBot || !tank.isAlive) continue

      let data = this.bots.get(tank.id)
      if (!data) {
        this.registerBot(tank.id)
        data = this.bots.get(tank.id)!
      }

      const moveAngle = this.calculateMoveAngle(tank, data, tanks, zone, now)
      const aimAngle = this.calculateAimAngle(tank, data, tanks)

      data.lastAimAngle = aimAngle
      moves.set(tank.id, { moveAngle, aimAngle })
    }

    return moves
  }

  private calculateMoveAngle(
    tank: Tank,
    data: BotData,
    tanks: Tank[],
    zone: Zone,
    now: number
  ): number | null {
    // Priority 1: Flee from zone edge
    const distToCenter = distance(tank.position, { x: zone.centerX, y: zone.centerY })
    if (distToCenter > zone.currentRadius - ZONE_MARGIN) {
      const dx = zone.centerX - tank.position.x
      const dy = zone.centerY - tank.position.y
      return vecToAngle(dx, dy)
    }

    // Priority 2: Chase nearest player (ONLY players, not bots)
    const players = tanks.filter(t =>
      !t.isBot && t.isAlive && t.id !== tank.id
    )

    let nearestPlayer: Tank | null = null
    let nearestDist = CHASE_RANGE

    for (const player of players) {
      const dist = distance(tank.position, player.position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestPlayer = player
      }
    }

    if (nearestPlayer) {
      const dx = nearestPlayer.position.x - tank.position.x
      const dy = nearestPlayer.position.y - tank.position.y
      return vecToAngle(dx, dy)
    }

    // Priority 3: Patrol to random points
    // Retarget if no target or timeout
    if (!data.patrolTarget || now - data.lastRetarget > RETARGET_INTERVAL) {
      // Pick random point far from current position
      let attempts = 0
      while (attempts < 10) {
        const targetX = Math.floor(Math.random() * (this.mapWidth - 40)) + 20
        const targetY = Math.floor(Math.random() * (this.mapHeight - 40)) + 20

        const dist = distance(tank.position, { x: targetX, y: targetY })
        if (dist > MIN_PATROL_DISTANCE) {
          data.patrolTarget = { x: targetX, y: targetY }
          data.lastRetarget = now
          break
        }
        attempts++
      }

      // Fallback if couldn't find far point
      if (!data.patrolTarget) {
        data.patrolTarget = {
          x: Math.floor(Math.random() * (this.mapWidth - 40)) + 20,
          y: Math.floor(Math.random() * (this.mapHeight - 40)) + 20
        }
        data.lastRetarget = now
      }
    }

    // Move toward patrol target
    if (data.patrolTarget) {
      const dx = data.patrolTarget.x - tank.position.x
      const dy = data.patrolTarget.y - tank.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Reached target - pick new one
      if (dist < 2) {
        data.patrolTarget = null
        return null
      }

      return vecToAngle(dx, dy)
    }

    return null
  }

  private calculateAimAngle(tank: Tank, data: BotData, tanks: Tank[]): number {
    // Always aim at nearest PLAYER (never at bots)
    const players = tanks.filter(t =>
      !t.isBot && t.isAlive && t.id !== tank.id
    )

    if (players.length === 0) {
      // No players - keep last aim or aim forward
      return data.lastAimAngle || tank.hullAngle
    }

    // Find nearest player
    let nearestPlayer: Tank | null = null
    let nearestDistSq = Infinity

    for (const player of players) {
      const dx = player.position.x - tank.position.x
      const dy = player.position.y - tank.position.y
      const distSq = dx * dx + dy * dy

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        nearestPlayer = player
      }
    }

    if (nearestPlayer) {
      const dx = nearestPlayer.position.x - tank.position.x
      const dy = nearestPlayer.position.y - tank.position.y
      return vecToAngle(dx, dy)
    }

    return data.lastAimAngle || tank.hullAngle
  }
}
