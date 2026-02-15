import type { Tank, Star, PowerUp, Portal, Zone, Vec2 } from '@tank-br/shared/types.js'
import { distance, vecToAngle, normalizeAngle } from '@tank-br/shared/math.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'

export interface BotMoveResult {
  moveAngle: number | null
  aimAngle: number
}

interface BotData {
  patrolTarget: Vec2 | null
  lastRetarget: number
  lastAimAngle: number
  patrolIndex: number  // Unique patrol index for each bot
}

const CHASE_RANGE = 20  // Range to detect and chase players
const ZONE_MARGIN = 10  // Distance from zone edge before fleeing
const RETARGET_INTERVAL = 3000  // Retarget patrol every 3 seconds
const MIN_PATROL_DISTANCE = 30  // Minimum distance for patrol targets
const BOT_REPULSION_RANGE = 4  // Bots avoid each other if closer than this
const BOT_REPULSION_STRENGTH = 2.0  // How strongly bots repel each other

export class BotController {
  private bots = new Map<string, BotData>()
  private nextPatrolIndex = 0

  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  registerBot(botId: string): void {
    this.bots.set(botId, {
      patrolTarget: null,
      lastRetarget: 0,
      lastAimAngle: 0,
      patrolIndex: this.nextPatrolIndex++
    })
    console.log(`Bot registered: ${botId}, patrol index: ${this.nextPatrolIndex - 1}`)
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
    // Priority 0: Avoid other bots (repulsion force)
    const bots = tanks.filter(t => t.isBot && t.isAlive && t.id !== tank.id)
    let repulsionX = 0
    let repulsionY = 0
    let repulsionCount = 0

    for (const other of bots) {
      const dx = tank.position.x - other.position.x
      const dy = tank.position.y - other.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < BOT_REPULSION_RANGE && dist > 0.1) {
        // Normalize and apply repulsion
        const strength = (BOT_REPULSION_RANGE - dist) / BOT_REPULSION_RANGE * BOT_REPULSION_STRENGTH
        repulsionX += (dx / dist) * strength
        repulsionY += (dy / dist) * strength
        repulsionCount++
      }
    }

    // If there's strong repulsion, move away from other bots
    if (repulsionCount > 0) {
      const repulsionMag = Math.sqrt(repulsionX * repulsionX + repulsionY * repulsionY)
      if (repulsionMag > 0.5) {
        return vecToAngle(repulsionX, repulsionY)
      }
    }

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

    // Priority 3: Patrol to random points (unique per bot)
    // Retarget if no target or timeout
    if (!data.patrolTarget || now - data.lastRetarget > RETARGET_INTERVAL) {
      // Use bot's unique patrol index to spread bots across map
      const angle = (data.patrolIndex * 2.4) % (Math.PI * 2)  // Different angle for each bot
      const radius = MIN_PATROL_DISTANCE + Math.random() * 30

      const centerX = this.mapWidth / 2
      const centerY = this.mapHeight / 2

      let targetX = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 40
      let targetY = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 40

      // Clamp to map bounds
      targetX = Math.max(20, Math.min(this.mapWidth - 20, targetX))
      targetY = Math.max(20, Math.min(this.mapHeight - 20, targetY))

      data.patrolTarget = { x: targetX, y: targetY }
      data.lastRetarget = now
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
