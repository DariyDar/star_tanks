import {
  MSG_FULL_STATE,
  MSG_LEADERBOARD,
  MSG_KILL,
  MSG_PORTAL_EXIT,
  numberToPhase,
  numberToPowerUp
} from './BinaryProtocol.js'
import {
  PowerUpType,
  Vec2,
  Tank,
  Bullet,
  Star,
  PowerUp,
  Portal,
  Zone,
  GameState,
  LeaderboardEntry
} from '../types.js'

/**
 * Metadata for a tank stored on the client
 */
export interface TankMeta {
  id: string
  name: string
  color: string
}

/**
 * Kill event data from the server
 */
export interface KillEventData {
  killerId: string
  killerName: string
  victimId: string
  victimName: string
  timestamp: number
}

/**
 * Portal exit event data
 */
export interface PortalExitEventData {
  tankId: string
  tankName: string
  exitPosition: Vec2
  timestamp: number
}

/**
 * Decoded message from the server
 */
export type DecodedMessage =
  | {
      type: 'fullState'
      state: GameState
    }
  | {
      type: 'leaderboard'
      leaderboard: LeaderboardEntry[]
      tick: number
    }
  | {
      type: 'killEvent'
      data: KillEventData
    }
  | {
      type: 'portalExitEvent'
      data: PortalExitEventData
    }
  | {
      type: 'unknown'
    }

/**
 * Binary decoder for game state messages
 *
 * Reconstructs GameState and other messages from binary buffers.
 * Requires starPositions (from map) and tankMeta (from join payload) to
 * fully reconstruct Star and Tank objects.
 */
export class BinaryDecoder {
  private view: DataView
  private offset: number = 0
  private starPositions: Vec2[]
  private tankMeta: Map<number, TankMeta>

  constructor(starPositions: Vec2[], tankMeta: Map<number, TankMeta> = new Map()) {
    this.starPositions = starPositions
    this.tankMeta = tankMeta
    this.view = new DataView(new ArrayBuffer(0))
  }

  /**
   * Main decode entry point - reads message type and dispatches
   */
  decode(buffer: ArrayBuffer): DecodedMessage {
    this.view = new DataView(buffer)
    this.offset = 0

    if (buffer.byteLength < 1) {
      return { type: 'unknown' }
    }

    const messageType = this.readUint8()

    switch (messageType) {
      case MSG_FULL_STATE:
        return {
          type: 'fullState',
          state: this.decodeFullState()
        }
      case MSG_LEADERBOARD:
        return this.decodeLeaderboard()
      case MSG_KILL:
        return this.decodeKillEvent()
      case MSG_PORTAL_EXIT:
        return this.decodePortalExitEvent()
      default:
        return { type: 'unknown' }
    }
  }

  /**
   * Decode a full game state message (0x01)
   *
   * Format:
   * - 4B tick
   * - 4B timestamp (float32)
   * - 1B phase
   * - 1B playersAlive
   * - 4B timeElapsed (float32)
   * - 18B zone data
   * - 1B starCount
   * - starCount × Star data
   * - 1B bulletCount
   * - bulletCount × Bullet data
   * - 1B powerUpCount
   * - powerUpCount × PowerUp data
   * - 1B portalCount
   * - portalCount × Portal data
   * - 1B tankCount
   * - tankCount × Tank data
   */
  private decodeFullState(): GameState {
    const tick = this.readUint32()
    const timestamp = this.readFloat32()
    const phaseNum = this.readUint8()
    const playersAlive = this.readUint8()
    const timeElapsed = this.readFloat32()
    const ctfTimeRemaining = this.readUint16()

    const phase = numberToPhase(phaseNum)

    // Decode zone (18 bytes)
    const zone = this.decodeZone()

    // Decode stars
    const starCount = this.readUint8()
    const stars: Star[] = []
    for (let i = 0; i < starCount; i++) {
      stars.push(this.decodeStar())
    }

    // Decode bullets
    const bulletCount = this.readUint8()
    const bullets: Bullet[] = []
    for (let i = 0; i < bulletCount; i++) {
      bullets.push(this.decodeBullet())
    }

    // Decode power-ups
    const powerUpCount = this.readUint8()
    const powerUps: PowerUp[] = []
    for (let i = 0; i < powerUpCount; i++) {
      powerUps.push(this.decodePowerUp())
    }

    // Decode portals
    const portalCount = this.readUint8()
    const portals: Portal[] = []
    for (let i = 0; i < portalCount; i++) {
      portals.push(this.decodePortal())
    }

    // Decode tanks
    const tankCount = this.readUint8()
    const tanks: Tank[] = []
    for (let i = 0; i < tankCount; i++) {
      tanks.push(this.decodeTank())
    }

    // Decode leaderboard (stored at end)
    const leaderboardCount = this.readUint8()
    const leaderboard: LeaderboardEntry[] = []
    for (let i = 0; i < leaderboardCount; i++) {
      leaderboard.push(this.decodeLeaderboardEntry())
    }

    // Decode boss (1 or 25 bytes)
    let boss = null
    const hasBoss = this.readUint8()
    if (hasBoss) {
      const x = this.readFloat32()
      const y = this.readFloat32()
      const hp = this.readUint16()
      const maxHp = this.readUint16()
      const phase = this.readUint8()
      const angle = this.readFloat32()
      const isAlive = this.readUint8() === 1
      const hasLaser = this.readUint8()
      const laserAngle = hasLaser ? this.readFloat32() : (this.offset += 4, undefined)
      const attackNum = this.readUint8()

      const attacks = ['circularBarrage', 'fanShot', 'spiral', 'rotatingLaser', 'tripleShot', 'teleportExplosion', 'mineField', 'bulletWave', 'chaosFire', 'rageMode']
      const currentAttack = attackNum > 0 ? attacks[attackNum - 1] as any : null

      boss = {
        id: 'boss_1',
        position: { x, y },
        hp,
        maxHp,
        currentAttack,
        lastAttackTime: 0,
        nextAttackAt: 0,
        phase,
        angle,
        laserAngle,
        isAlive,
        lastPhaseRewardAt: 0
      }
    }

    // Decode CTF state (if present and buffer has remaining data)
    let ctf = null
    if (this.offset < this.view.byteLength) {
      const hasCTF = this.readUint8()
      if (hasCTF) {
        const flagAx = this.readFloat32()
        const flagAy = this.readFloat32()
        const flagBx = this.readFloat32()
        const flagBy = this.readFloat32()
        const scoreA = this.readUint8()
        const scoreB = this.readUint8()
        const baseAx = this.readUint16()
        const baseAy = this.readUint16()
        const baseAw = this.readUint16()
        const baseAh = this.readUint16()
        const baseBx = this.readUint16()
        const baseBy = this.readUint16()
        const baseBw = this.readUint16()
        const baseBh = this.readUint16()
        const ctfFlags = this.readUint8()

        ctf = {
          flagA: { x: flagAx, y: flagAy },
          flagB: { x: flagBx, y: flagBy },
          flagACarrier: null,
          flagBCarrier: null,
          flagADropped: (ctfFlags & 1) !== 0,
          flagBDropped: (ctfFlags & 2) !== 0,
          scoreA,
          scoreB,
          baseA: { x: baseAx, y: baseAy, w: baseAw, h: baseAh },
          baseB: { x: baseBx, y: baseBy, w: baseBw, h: baseBh }
        }
      }
    }

    // Decode destroyed obstacles
    const destroyedObstacles: Vec2[] = []
    if (this.offset + 2 <= this.view.byteLength) {
      const destroyedCount = this.readUint16()
      for (let i = 0; i < destroyedCount; i++) {
        const dx = this.readUint8()
        const dy = this.readUint8()
        destroyedObstacles.push({ x: dx, y: dy })
      }
    }

    return {
      tick,
      timestamp,
      phase,
      tanks,
      bullets,
      stars,
      powerUps,
      portals,
      zone,
      boss,
      ctf,
      ctfTimeRemaining,
      destroyedObstacles,
      leaderboard,
      playersAlive,
      timeElapsed
    }
  }

  /**
   * Decode a single Tank (35 bytes)
   *
   * Format:
   * - 1B index
   * - 4B x (float32)
   * - 4B y (float32)
   * - 4B hullAngle (float32)
   * - 4B turretAngle (float32)
   * - 1B hp
   * - 1B maxHp
   * - 2B stars
   * - 2B kills
   * - 1B flags (bit0=isAlive, bit1=isBot, others reserved)
   * - 1B unused
   * - 4B powerUpEndTime (float32)
   * - 2B fireCooldown
   * - 4B tankRadius (float32)
   */
  private decodeTank(): Tank {
    const index = this.readUint8()
    const x = this.readFloat32()
    const y = this.readFloat32()
    const hullAngle = this.readFloat32()
    const turretAngle = this.readFloat32()
    const hp = this.readUint8()
    const maxHp = this.readUint8()
    const stars = this.readUint16()
    const kills = this.readUint16()
    const flags = this.readUint8()
    this.readUint8() // reserved
    const powerUpEndTime = this.readFloat32()
    const fireCooldown = this.readUint16()
    const tankRadius = this.readFloat32()

    const isAlive = (flags & 0x01) !== 0
    const isBot = (flags & 0x02) !== 0
    const teamBits = (flags >> 2) & 0x03
    const team = teamBits === 1 ? 'a' as const : teamBits === 2 ? 'b' as const : undefined
    const hasFlag = (flags & 0x10) !== 0

    let activePowerUp: PowerUpType | null = null
    if (powerUpEndTime > 0) {
      activePowerUp = PowerUpType.RapidFire
    }

    const meta = this.tankMeta.get(index)
    const id = meta?.id ?? `tank-${index}`
    const name = meta?.name ?? `Player ${index}`
    const color = meta?.color ?? '#ffffff'

    return {
      id,
      name,
      position: { x, y },
      hullAngle,
      turretAngle,
      hp,
      maxHp,
      stars,
      kills,
      isBot,
      isAlive,
      activePowerUp,
      powerUpEndTime,
      lastFireTime: 0,
      fireCooldown,
      speed: 0,
      color,
      magnetRadius: 1,
      tankRadius,
      lastDamageTime: 0,
      quicksandSlowEndTime: 0,
      inBush: false,
      team,
      hasFlag: hasFlag || undefined
    }
  }

  /**
   * Decode a single Bullet (14 bytes)
   *
   * Format:
   * - 1B id (8-bit bullet index)
   * - 4B x (float32)
   * - 4B y (float32)
   * - 4B angle (float32)
   * - 1B distanceTraveled (compressed: 0-255)
   */
  private decodeBullet(): Bullet {
    const bulletId = this.readUint8()
    const x = this.readFloat32()
    const y = this.readFloat32()
    const angle = this.readFloat32()
    const distByte = this.readUint8()
    const distanceTraveled = distByte & 0x7F
    const isRocket = (distByte & 0x80) !== 0

    return {
      id: `bullet-${bulletId}`,
      ownerId: '',
      position: { x, y },
      angle,
      distanceTraveled,
      isRocket
    }
  }

  /**
   * Decode a single Star (5 bytes)
   *
   * Format:
   * - 1B starIndex (into starPositions array)
   * - 1B active (0 or 1)
   * - 4B respawnAt (float32, timestamp)
   */
  private decodeStar(): Star {
    const starIndex = this.readUint8()
    const active = this.readUint8() !== 0
    const respawnAt = this.readFloat32()

    const pos = this.starPositions[starIndex] ?? { x: 0, y: 0 }

    return {
      id: `star-${starIndex}`,
      position: pos,
      active,
      respawnAt
    }
  }

  /**
   * Decode a single PowerUp (10 bytes)
   *
   * Format:
   * - 4B x (float32)
   * - 4B y (float32)
   * - 1B type (numeric: 0=RapidFire, 1=Speed, 2=Shield)
   * - 1B spawnedAt (compressed, relative to current time)
   */
  private decodePowerUp(): PowerUp {
    const x = this.readFloat32()
    const y = this.readFloat32()
    const typeNum = this.readUint8()
    const spawnedAt = this.readUint8()

    // In a full implementation, spawnedAt would be properly encoded
    // For now, use a placeholder
    const type = numberToPowerUp(typeNum)

    return {
      id: `powerup-${Math.random()}`,
      type,
      position: { x, y },
      spawnedAt
    }
  }

  /**
   * Decode a single Portal (9 bytes)
   *
   * Format:
   * - 4B x (float32)
   * - 4B y (float32)
   * - 1B isActive (0 or 1)
   *
   * Note: spawnedAt and expiresAt would be computed client-side from tick
   */
  private decodePortal(): Portal {
    const x = this.readFloat32()
    const y = this.readFloat32()
    this.readUint8() // isActive flag (reserved for future use)

    return {
      id: `portal-${Math.random()}`,
      position: { x, y },
      spawnedAt: 0, // Computed client-side
      expiresAt: 0  // Computed client-side
    }
  }

  /**
   * Decode a Zone (18 bytes)
   *
   * Format:
   * - 4B centerX (float32)
   * - 4B centerY (float32)
   * - 4B currentRadius (float32)
   * - 4B targetRadius (float32)
   * - 1B phase
   * - 1B isShrinking (0 or 1)
   */
  private decodeZone(): Zone {
    const centerX = this.readFloat32()
    const centerY = this.readFloat32()
    const currentRadius = this.readFloat32()
    const targetRadius = this.readFloat32()
    const phase = this.readUint8()
    const isShrinking = this.readUint8() !== 0

    return {
      centerX,
      centerY,
      currentRadius,
      targetRadius,
      shrinkSpeed: 0, // Computed client-side
      phase,
      isShrinking,
      nextShrinkAt: 0 // Computed client-side
    }
  }

  /**
   * Decode a Leaderboard message (0x03)
   *
   * Format after message type:
   * - 4B tick
   * - 1B entryCount
   * - entryCount × LeaderboardEntry
   */
  private decodeLeaderboard(): DecodedMessage {
    const tick = this.readUint32()
    const entryCount = this.readUint8()
    const leaderboard: LeaderboardEntry[] = []

    for (let i = 0; i < entryCount; i++) {
      leaderboard.push(this.decodeLeaderboardEntry())
    }

    return {
      type: 'leaderboard',
      leaderboard,
      tick
    }
  }

  /**
   * Decode a LeaderboardEntry (6 bytes)
   *
   * Format:
   * - 1B tankIndex
   * - 2B kills
   * - 2B stars
   * - 1B flags (bit0=isAlive, others reserved)
   */
  private decodeLeaderboardEntry(): LeaderboardEntry {
    const tankIndex = this.readUint8()
    const kills = this.readUint16()
    const stars = this.readUint16()
    const flags = this.readUint8()

    const isAlive = (flags & 0x01) !== 0

    const meta = this.tankMeta.get(tankIndex)
    const id = meta?.id ?? `tank-${tankIndex}`
    const name = meta?.name ?? `Player ${tankIndex}`

    return {
      id,
      name,
      kills,
      stars,
      isAlive
    }
  }

  /**
   * Decode a Kill Event message (0x04)
   *
   * Format after message type:
   * - 1B killerIndex
   * - 1B victimIndex
   * - 4B timestamp (float32)
   */
  private decodeKillEvent(): DecodedMessage {
    const killerIndex = this.readUint8()
    const victimIndex = this.readUint8()
    const timestamp = this.readFloat32()

    const killerMeta = this.tankMeta.get(killerIndex)
    const victimMeta = this.tankMeta.get(victimIndex)

    const data: KillEventData = {
      killerId: killerMeta?.id ?? `tank-${killerIndex}`,
      killerName: killerMeta?.name ?? `Player ${killerIndex}`,
      victimId: victimMeta?.id ?? `tank-${victimIndex}`,
      victimName: victimMeta?.name ?? `Player ${victimIndex}`,
      timestamp
    }

    return {
      type: 'killEvent',
      data
    }
  }

  /**
   * Decode a Portal Exit Event message (0x05)
   *
   * Format after message type:
   * - 1B tankIndex
   * - 4B x (float32)
   * - 4B y (float32)
   * - 4B timestamp (float32)
   */
  private decodePortalExitEvent(): DecodedMessage {
    const tankIndex = this.readUint8()
    const x = this.readFloat32()
    const y = this.readFloat32()
    const timestamp = this.readFloat32()

    const meta = this.tankMeta.get(tankIndex)

    const data: PortalExitEventData = {
      tankId: meta?.id ?? `tank-${tankIndex}`,
      tankName: meta?.name ?? `Player ${tankIndex}`,
      exitPosition: { x, y },
      timestamp
    }

    return {
      type: 'portalExitEvent',
      data
    }
  }

  /**
   * Update tank metadata when a new player joins
   */
  updateTankMeta(index: number, meta: TankMeta): void {
    this.tankMeta.set(index, meta)
  }

  /**
   * Remove tank metadata when a player leaves
   */
  removeTankMeta(index: number): void {
    this.tankMeta.delete(index)
  }

  // Helper methods for reading from DataView

  private readUint8(): number {
    const val = this.view.getUint8(this.offset)
    this.offset += 1
    return val
  }

  private readUint16(): number {
    const val = this.view.getUint16(this.offset, true)
    this.offset += 2
    return val
  }

  private readUint32(): number {
    const val = this.view.getUint32(this.offset, true)
    this.offset += 4
    return val
  }

  private readFloat32(): number {
    const val = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return val
  }
}

export default BinaryDecoder
