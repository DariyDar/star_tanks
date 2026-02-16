import type { Tank, Star, PowerUp, Portal, Zone, Vec2 } from '@tank-br/shared/types.js'
import { distance, vecToAngle } from '@tank-br/shared/math.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'

export interface BotMoveResult {
  moveAngle: number | null
  aimAngle: number
}

export interface CTFInfo {
  flagA: Vec2
  flagB: Vec2
  flagACarrier: string | null
  flagBCarrier: string | null
  baseA: { x: number; y: number; w: number; h: number }
  baseB: { x: number; y: number; w: number; h: number }
}

interface BotData {
  patrolTarget: Vec2 | null
  lastRetarget: number
  lastAimAngle: number
  patrolIndex: number
  targetPlayerId: string | null  // Which player this bot is targeting
}

const CHASE_RANGE = 25  // Range to detect and chase players
const ZONE_MARGIN = 10  // Distance from zone edge before fleeing
const RETARGET_INTERVAL = 3000  // Retarget patrol every 3 seconds
const MIN_PATROL_DISTANCE = 30  // Minimum distance for patrol targets
const BOT_REPULSION_RANGE = 4  // Bots avoid each other if closer than this
const BOT_REPULSION_STRENGTH = 2.0  // How strongly bots repel each other
const MAX_BOTS_PER_TARGET = 3  // Maximum bots that can target the same player
const STEALTH_REVEAL_DISTANCE = 3  // Bots can only see tanks in bushes within this distance

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
      patrolIndex: this.nextPatrolIndex++,
      targetPlayerId: null
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
    now: number,
    ctf?: CTFInfo
  ): Map<string, BotMoveResult> {
    const moves = new Map<string, BotMoveResult>()

    // Find the richest player (leader)
    const players = tanks.filter(t => !t.isBot && t.isAlive)
    const richestPlayer = this.findRichestPlayer(players)

    // Count how many bots are already targeting each player
    const targetCounts = new Map<string, number>()
    for (const data of this.bots.values()) {
      if (data.targetPlayerId) {
        targetCounts.set(data.targetPlayerId, (targetCounts.get(data.targetPlayerId) || 0) + 1)
      }
    }

    for (const tank of tanks) {
      if (!tank.isBot || !tank.isAlive) continue

      let data = this.bots.get(tank.id)
      if (!data) {
        this.registerBot(tank.id)
        data = this.bots.get(tank.id)!
      }

      let moveAngle: number | null
      let aimAngle: number

      if (ctf && tank.team) {
        // CTF mode: specialized behavior
        moveAngle = this.calculateCTFMoveAngle(tank, data, tanks, zone, now, ctf)
        aimAngle = this.calculateCTFAimAngle(tank, data, tanks)
      } else {
        moveAngle = this.calculateMoveAngle(tank, data, tanks, zone, now, richestPlayer, targetCounts)
        aimAngle = this.calculateAimAngle(tank, data, tanks)
      }

      data.lastAimAngle = aimAngle
      moves.set(tank.id, { moveAngle, aimAngle })
    }

    return moves
  }

  // --- CTF-specific bot logic ---

  private calculateCTFMoveAngle(
    tank: Tank,
    data: BotData,
    tanks: Tank[],
    zone: Zone,
    now: number,
    ctf: CTFInfo
  ): number | null {
    // Bot repulsion (same as normal mode)
    const bots = tanks.filter(t => t.isBot && t.isAlive && t.id !== tank.id)
    let repulsionX = 0, repulsionY = 0, repulsionCount = 0
    for (const other of bots) {
      const dx = tank.position.x - other.position.x
      const dy = tank.position.y - other.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < BOT_REPULSION_RANGE && dist > 0.1) {
        const strength = (BOT_REPULSION_RANGE - dist) / BOT_REPULSION_RANGE * BOT_REPULSION_STRENGTH
        repulsionX += (dx / dist) * strength
        repulsionY += (dy / dist) * strength
        repulsionCount++
      }
    }
    if (repulsionCount > 0 && Math.sqrt(repulsionX * repulsionX + repulsionY * repulsionY) > 0.5) {
      return vecToAngle(repulsionX, repulsionY)
    }

    const myTeam = tank.team!
    const enemyTeam = myTeam === 'a' ? 'b' : 'a'

    // If carrying flag: navigate to base door first, then inside
    if (tank.hasFlag) {
      const myBase = myTeam === 'a' ? ctf.baseA : ctf.baseB
      const doorY = myBase.y + myBase.h / 2

      // Door entry point: just outside the door opening
      // Base A opens right (door on right wall), Base B opens left (door on left wall)
      const doorX = myTeam === 'a'
        ? myBase.x + myBase.w + 1  // just outside right wall
        : myBase.x - 1             // just outside left wall

      const distToDoor = Math.sqrt(
        (tank.position.x - doorX) ** 2 + (tank.position.y - doorY) ** 2
      )

      if (distToDoor < 3) {
        // Close to door — head through it to base center
        const cx = myBase.x + myBase.w / 2
        const cy = myBase.y + myBase.h / 2
        return vecToAngle(cx - tank.position.x, cy - tank.position.y)
      }

      // Navigate to door entry point first
      return vecToAngle(doorX - tank.position.x, doorY - tank.position.y)
    }

    // If enemy flag has no carrier: go grab it
    const enemyFlagCarrier = myTeam === 'a' ? ctf.flagBCarrier : ctf.flagACarrier
    const enemyFlagPos = myTeam === 'a' ? ctf.flagB : ctf.flagA
    if (!enemyFlagCarrier) {
      // Some bots go for flag, others fight
      if (data.patrolIndex % 3 !== 2) {
        const dx = enemyFlagPos.x - tank.position.x
        const dy = enemyFlagPos.y - tank.position.y
        return vecToAngle(dx, dy)
      }
    }

    // Chase nearest enemy (bot or player)
    let nearestEnemy: Tank | null = null
    let nearestDist = Infinity
    for (const t of tanks) {
      if (!t.isAlive || t.id === tank.id) continue
      if (t.team === myTeam) continue // same team, don't chase
      const dist = distance(tank.position, t.position)
      if (dist < CHASE_RANGE && dist < nearestDist) {
        // Stealth check
        if (!t.inBush || dist <= STEALTH_REVEAL_DISTANCE) {
          nearestDist = dist
          nearestEnemy = t
        }
      }
    }
    if (nearestEnemy) {
      const dx = nearestEnemy.position.x - tank.position.x
      const dy = nearestEnemy.position.y - tank.position.y
      return vecToAngle(dx, dy)
    }

    // Patrol: move toward enemy base area
    if (!data.patrolTarget || now - data.lastRetarget > RETARGET_INTERVAL) {
      const enemyBase = myTeam === 'a' ? ctf.baseB : ctf.baseA
      const targetX = enemyBase.x + Math.random() * enemyBase.w
      const targetY = enemyBase.y + Math.random() * enemyBase.h
      data.patrolTarget = { x: targetX, y: targetY }
      data.lastRetarget = now
    }

    if (data.patrolTarget) {
      const dx = data.patrolTarget.x - tank.position.x
      const dy = data.patrolTarget.y - tank.position.y
      if (dx * dx + dy * dy < 4) {
        data.patrolTarget = null
        return null
      }
      return vecToAngle(dx, dy)
    }

    return null
  }

  private calculateCTFAimAngle(tank: Tank, data: BotData, tanks: Tank[]): number {
    const myTeam = tank.team!
    // Aim at nearest enemy (any team member - bots AND players)
    let nearestEnemy: Tank | null = null
    let nearestDistSq = Infinity

    for (const t of tanks) {
      if (!t.isAlive || t.id === tank.id) continue
      if (t.team === myTeam) continue // don't aim at teammates

      const dx = t.position.x - tank.position.x
      const dy = t.position.y - tank.position.y
      const distSq = dx * dx + dy * dy
      const dist = Math.sqrt(distSq)

      if (!t.inBush || dist <= STEALTH_REVEAL_DISTANCE) {
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq
          nearestEnemy = t
        }
      }
    }

    if (nearestEnemy) {
      const dx = nearestEnemy.position.x - tank.position.x
      const dy = nearestEnemy.position.y - tank.position.y
      return vecToAngle(dx, dy)
    }

    return data.lastAimAngle || tank.hullAngle
  }

  private findRichestPlayer(players: Tank[]): Tank | null {
    if (players.length === 0) return null

    let richest = players[0]
    for (const player of players) {
      if (player.stars > richest.stars) {
        richest = player
      }
    }
    return richest
  }

  private calculateMoveAngle(
    tank: Tank,
    data: BotData,
    tanks: Tank[],
    zone: Zone,
    now: number,
    richestPlayer: Tank | null,
    targetCounts: Map<string, number>
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

    // Priority 2: Chase richest player (only if less than 3 bots are already chasing)
    if (richestPlayer && richestPlayer.stars > 0) {
      const dist = distance(tank.position, richestPlayer.position)
      const currentTargetCount = targetCounts.get(richestPlayer.id) || 0

      // Stealth check: if player is in bush, only chase if very close
      const canSeePlayer = !richestPlayer.inBush || dist <= STEALTH_REVEAL_DISTANCE

      // Can attack if:
      // 1. Already targeting this player, OR
      // 2. Less than MAX_BOTS_PER_TARGET are targeting them, AND
      // 3. Player is in range, AND
      // 4. Bot can see the player (not hidden in bush or close enough)
      if (dist < CHASE_RANGE && canSeePlayer) {
        if (data.targetPlayerId === richestPlayer.id || currentTargetCount < MAX_BOTS_PER_TARGET) {
          // Start targeting
          if (data.targetPlayerId !== richestPlayer.id) {
            data.targetPlayerId = richestPlayer.id
            targetCounts.set(richestPlayer.id, currentTargetCount + 1)
          }

          const dx = richestPlayer.position.x - tank.position.x
          const dy = richestPlayer.position.y - tank.position.y
          return vecToAngle(dx, dy)
        }
      }
    }

    // No longer chasing anyone
    if (data.targetPlayerId) {
      data.targetPlayerId = null
    }

    // Priority 3: Patrol to random points (unique per bot)
    if (!data.patrolTarget || now - data.lastRetarget > RETARGET_INTERVAL) {
      // Use bot's unique patrol index to spread bots across map
      const angle = (data.patrolIndex * 2.4) % (Math.PI * 2)
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
      return data.lastAimAngle || tank.hullAngle
    }

    // Find nearest visible player (not hidden in bush or close enough to see)
    let nearestPlayer: Tank | null = null
    let nearestDistSq = Infinity

    for (const player of players) {
      const dx = player.position.x - tank.position.x
      const dy = player.position.y - tank.position.y
      const distSq = dx * dx + dy * dy
      const dist = Math.sqrt(distSq)

      // Stealth check: if player is in bush, only aim if very close
      const canSeePlayer = !player.inBush || dist <= STEALTH_REVEAL_DISTANCE

      if (canSeePlayer && distSq < nearestDistSq) {
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
