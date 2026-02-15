import { GameState, LeaderboardEntry, Tank, Bullet, PowerUp, Portal } from '../types.js'
import { IndexMap } from './IndexMap.js'
import {
  MSG_FULL_STATE,
  MSG_LEADERBOARD,
  MSG_KILL,
  MSG_PORTAL_EXIT,
  HEADER_SIZE,
  ZONE_SIZE,
  TANK_DATA_SIZE,
  BULLET_DATA_SIZE,
  POWERUP_DATA_SIZE,
  PORTAL_DATA_SIZE,
  LEADERBOARD_ENTRY_SIZE,
  directionToNumber,
  phaseToNumber,
  powerUpToNumber
} from './BinaryProtocol.js'
import { TANK_COLORS } from '../constants.js'

/**
 * Encodes full game state into binary format
 */
export function encodeFullState(state: GameState, indexMap: IndexMap): ArrayBuffer {
  const tankCount = state.tanks.length
  const bulletCount = state.bullets.length
  const powerUpCount = state.powerUps.length
  const portalCount = state.portals.length
  
  // Calculate total size
  const size = HEADER_SIZE + ZONE_SIZE + 
    1 + (tankCount * TANK_DATA_SIZE) +  // tankCount + tank data
    1 + (bulletCount * BULLET_DATA_SIZE) +  // bulletCount + bullet data
    4 +  // star active bits (uint32)
    1 + (powerUpCount * POWERUP_DATA_SIZE) +  // powerUpCount + powerup data
    1 + (portalCount * PORTAL_DATA_SIZE)  // portalCount + portal data

  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  let offset = 0

  // Header (15 bytes)
  view.setUint8(offset, MSG_FULL_STATE); offset += 1
  view.setUint32(offset, state.tick, true); offset += 4
  view.setFloat32(offset, state.timestamp, true); offset += 4
  view.setUint8(offset, phaseToNumber(state.phase)); offset += 1
  view.setUint8(offset, state.playersAlive); offset += 1
  view.setFloat32(offset, state.timeElapsed, true); offset += 4

  // Zone (18 bytes)
  view.setUint16(offset, Math.round(state.zone.centerX), true); offset += 2
  view.setUint16(offset, Math.round(state.zone.centerY), true); offset += 2
  view.setFloat32(offset, state.zone.currentRadius, true); offset += 4
  view.setFloat32(offset, state.zone.targetRadius, true); offset += 4
  view.setUint8(offset, state.zone.isShrinking ? 1 : 0); offset += 1
  view.setUint8(offset, state.zone.phase); offset += 1
  view.setFloat32(offset, state.zone.nextShrinkAt, true); offset += 4

  // Tanks
  view.setUint8(offset, tankCount); offset += 1
  for (const tank of state.tanks) {
    offset = encodeTank(view, offset, tank, indexMap)
  }

  // Bullets
  view.setUint8(offset, bulletCount); offset += 1
  for (const bullet of state.bullets) {
    offset = encodeBullet(view, offset, bullet, indexMap)
  }

  // Stars (bitfield)
  const starBits = computeStarBits(state.stars)
  view.setUint32(offset, starBits, true); offset += 4

  // PowerUps
  view.setUint8(offset, powerUpCount); offset += 1
  for (const powerUp of state.powerUps) {
    offset = encodePowerUp(view, offset, powerUp)
  }

  // Portals
  view.setUint8(offset, portalCount); offset += 1
  for (const portal of state.portals) {
    offset = encodePortal(view, offset, portal)
  }

  return buffer
}

/**
 * Encodes a single tank (24 bytes)
 */
function encodeTank(view: DataView, offset: number, tank: Tank, indexMap: IndexMap): number {
  const index = indexMap.getIndex(tank.id)
  if (index === undefined) {
    throw new Error(`Tank ${tank.id} not found in index map`)
  }

  // Build flags byte
  let flags = 0
  if (tank.isBot) flags |= (1 << 0)
  if (tank.isAlive) flags |= (1 << 1)
  if (tank.activePowerUp === 'shield') flags |= (1 << 2)
  if (tank.activePowerUp === 'rapidFire') flags |= (1 << 3)
  if (tank.activePowerUp === 'speed') flags |= (1 << 4)

  // Find color index
  const colorIndex = TANK_COLORS.indexOf(tank.color)

  view.setUint8(offset, index); offset += 1
  view.setFloat32(offset, tank.position.x, true); offset += 4
  view.setFloat32(offset, tank.position.y, true); offset += 4
  view.setUint8(offset, directionToNumber(tank.direction)); offset += 1
  view.setUint8(offset, tank.hp); offset += 1
  view.setUint8(offset, tank.maxHp); offset += 1
  view.setUint16(offset, tank.stars, true); offset += 2
  view.setUint16(offset, tank.kills, true); offset += 2
  view.setUint8(offset, flags); offset += 1
  view.setUint8(offset, colorIndex !== -1 ? colorIndex : 0); offset += 1
  view.setFloat32(offset, tank.powerUpEndTime, true); offset += 4
  view.setUint16(offset, tank.fireCooldown, true); offset += 2

  return offset
}

/**
 * Encodes a single bullet (11 bytes)
 */
function encodeBullet(view: DataView, offset: number, bullet: Bullet, indexMap: IndexMap): number {
  const ownerIndex = indexMap.getIndex(bullet.ownerId)
  if (ownerIndex === undefined) {
    throw new Error(`Bullet owner ${bullet.ownerId} not found in index map`)
  }

  view.setUint8(offset, ownerIndex); offset += 1
  view.setFloat32(offset, bullet.position.x, true); offset += 4
  view.setFloat32(offset, bullet.position.y, true); offset += 4
  view.setUint8(offset, directionToNumber(bullet.direction)); offset += 1
  view.setUint8(offset, Math.round(bullet.distanceTraveled)); offset += 1

  return offset
}

/**
 * Computes star active bitfield (30 stars max)
 */
function computeStarBits(stars: Array<{ active: boolean }>): number {
  let bits = 0
  for (let i = 0; i < Math.min(stars.length, 30); i++) {
    if (stars[i].active) {
      bits |= (1 << i)
    }
  }
  return bits
}

/**
 * Encodes a single powerup (10 bytes)
 */
function encodePowerUp(view: DataView, offset: number, powerUp: PowerUp): number {
  view.setUint8(offset, powerUpToNumber(powerUp.type)); offset += 1
  view.setFloat32(offset, powerUp.position.x, true); offset += 4
  view.setFloat32(offset, powerUp.position.y, true); offset += 4
  view.setUint8(offset, parseInt(powerUp.id.split('_')[1] || '0')); offset += 1
  return offset
}

/**
 * Encodes a single portal (9 bytes)
 */
function encodePortal(view: DataView, offset: number, portal: Portal): number {
  view.setFloat32(offset, portal.position.x, true); offset += 4
  view.setFloat32(offset, portal.position.y, true); offset += 4
  view.setUint8(offset, parseInt(portal.id.split('_')[1] || '0')); offset += 1
  return offset
}

/**
 * Encodes leaderboard (sent every 5th tick)
 */
export function encodeLeaderboard(entries: LeaderboardEntry[], indexMap: IndexMap): ArrayBuffer {
  const entryCount = entries.length
  const size = 2 + (entryCount * LEADERBOARD_ENTRY_SIZE)  // type + count + entries
  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  let offset = 0

  view.setUint8(offset, MSG_LEADERBOARD); offset += 1
  view.setUint8(offset, entryCount); offset += 1

  for (const entry of entries) {
    const index = indexMap.getIndex(entry.id)
    if (index === undefined) continue

    let flags = 0
    if (entry.isAlive) flags |= (1 << 0)

    view.setUint8(offset, index); offset += 1
    view.setUint16(offset, entry.stars, true); offset += 2
    view.setUint16(offset, entry.kills, true); offset += 2
    view.setUint8(offset, flags); offset += 1
  }

  return buffer
}

/**
 * Encodes kill event
 */
export function encodeKillEvent(deadIndex: number, killerIndex: number): ArrayBuffer {
  const buffer = new ArrayBuffer(3)
  const view = new DataView(buffer)
  
  view.setUint8(0, MSG_KILL)
  view.setUint8(1, deadIndex)
  view.setUint8(2, killerIndex === -1 ? 0xFF : killerIndex)  // 0xFF = zone kill

  return buffer
}

/**
 * Encodes portal exit event
 */
export function encodePortalExitEvent(playerIndex: number, stars: number): ArrayBuffer {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  
  view.setUint8(0, MSG_PORTAL_EXIT)
  view.setUint8(1, playerIndex)
  view.setUint16(2, stars, true)

  return buffer
}
