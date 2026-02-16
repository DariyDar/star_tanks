import { GameState, LeaderboardEntry, Tank, Bullet, PowerUp, Portal, Star } from '../types.js'
import { IndexMap } from './IndexMap.js'
import {
  MSG_FULL_STATE,
  MSG_LEADERBOARD,
  MSG_KILL,
  MSG_PORTAL_EXIT,
  LEADERBOARD_ENTRY_SIZE,
  phaseToNumber,
  powerUpToNumber
} from './BinaryProtocol.js'
import { TANK_COLORS } from '../constants.js'

// Star item size: index(1) + active(1) + respawnAt(4) = 6
const STAR_ITEM_SIZE = 6
// Tank size: index(1) + x(4) + y(4) + hullAngle(4) + turretAngle(4) + hp(1) + maxHp(1) + stars(2) + kills(2) + flags(1) + colorIdx(1) + powerUpEndTime(4) + fireCooldown(2) + tankRadius(4) = 35
const TANK_ENCODE_SIZE = 35
// Bullet size: ownerIndex(1) + x(4) + y(4) + angle(4) + dist(1) = 14
const BULLET_ENCODE_SIZE = 14
// PowerUp size: x(4) + y(4) + type(1) + spawnedAt(1) = 10
const POWERUP_ENCODE_SIZE = 10
// Portal size: x(4) + y(4) + isActive(1) = 9
const PORTAL_ENCODE_SIZE = 9

/**
 * Encodes full game state into binary format.
 * Order must match BinaryDecoder: Header → Zone → Stars → Bullets → PowerUps → Portals → Tanks → Leaderboard
 */
export function encodeFullState(state: GameState, indexMap: IndexMap): ArrayBuffer {
  const starCount = state.stars.length
  const bulletCount = state.bullets.length
  const powerUpCount = state.powerUps.length
  const portalCount = state.portals.length
  const tankCount = state.tanks.length
  const leaderboardCount = state.leaderboard.length

  // Boss encoding size: hasBoss(1) + x(4) + y(4) + hp(2) + maxHp(2) + phase(1) + angle(4) + isAlive(1) + hasLaser(1) + laserAngle(4) + attack(1) = 25
  const bossSize = state.boss ? 25 : 1

  // CTF encoding size: hasCTF(1) + flagAx(4) + flagAy(4) + flagBx(4) + flagBy(4) + scoreA(1) + scoreB(1) + baseAx(2) + baseAy(2) + baseAw(2) + baseAh(2) + baseBx(2) + baseBy(2) + baseBw(2) + baseBh(2) + flags(1) = 36
  const ctfSize = state.ctf ? 36 : 1

  // Header(15) + Zone(18) + Stars(1+n*6) + Bullets(1+n*14) + PowerUps(1+n*10) + Portals(1+n*9) + Tanks(1+n*35) + Leaderboard(1+n*6) + Boss(1 or 25) + CTF(1 or 36)
  const size = 15 + 18 +
    1 + starCount * STAR_ITEM_SIZE +
    1 + bulletCount * BULLET_ENCODE_SIZE +
    1 + powerUpCount * POWERUP_ENCODE_SIZE +
    1 + portalCount * PORTAL_ENCODE_SIZE +
    1 + tankCount * TANK_ENCODE_SIZE +
    1 + leaderboardCount * LEADERBOARD_ENTRY_SIZE +
    bossSize +
    ctfSize

  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  let offset = 0

  // Header (15 bytes) — type already consumed by decoder before decodeFullState
  view.setUint8(offset, MSG_FULL_STATE); offset += 1
  view.setUint32(offset, state.tick, true); offset += 4
  view.setFloat32(offset, state.timestamp, true); offset += 4
  view.setUint8(offset, phaseToNumber(state.phase)); offset += 1
  view.setUint8(offset, state.playersAlive); offset += 1
  view.setFloat32(offset, state.timeElapsed, true); offset += 4

  // Zone (18 bytes) — decoder reads as float32 for centerX/Y
  view.setFloat32(offset, state.zone.centerX, true); offset += 4
  view.setFloat32(offset, state.zone.centerY, true); offset += 4
  view.setFloat32(offset, state.zone.currentRadius, true); offset += 4
  view.setFloat32(offset, state.zone.targetRadius, true); offset += 4
  view.setUint8(offset, state.zone.phase); offset += 1
  view.setUint8(offset, state.zone.isShrinking ? 1 : 0); offset += 1

  // Stars
  view.setUint8(offset, starCount); offset += 1
  for (let i = 0; i < starCount; i++) {
    const star = state.stars[i]
    view.setUint8(offset, i); offset += 1
    view.setUint8(offset, star.active ? 1 : 0); offset += 1
    view.setFloat32(offset, star.respawnAt, true); offset += 4
  }

  // Bullets
  view.setUint8(offset, bulletCount); offset += 1
  for (const bullet of state.bullets) {
    offset = encodeBullet(view, offset, bullet, indexMap)
  }

  // PowerUps
  view.setUint8(offset, powerUpCount); offset += 1
  for (const powerUp of state.powerUps) {
    view.setFloat32(offset, powerUp.position.x, true); offset += 4
    view.setFloat32(offset, powerUp.position.y, true); offset += 4
    view.setUint8(offset, powerUpToNumber(powerUp.type)); offset += 1
    view.setUint8(offset, 0); offset += 1 // spawnedAt placeholder
  }

  // Portals
  view.setUint8(offset, portalCount); offset += 1
  for (const portal of state.portals) {
    view.setFloat32(offset, portal.position.x, true); offset += 4
    view.setFloat32(offset, portal.position.y, true); offset += 4
    view.setUint8(offset, 1); offset += 1 // isActive
  }

  // Tanks
  view.setUint8(offset, tankCount); offset += 1
  for (const tank of state.tanks) {
    offset = encodeTank(view, offset, tank, indexMap)
  }

  // Leaderboard
  view.setUint8(offset, leaderboardCount); offset += 1
  for (const entry of state.leaderboard) {
    offset = encodeLeaderboardEntry(view, offset, entry, indexMap)
  }

  // Boss (1 or 25 bytes)
  if (state.boss && state.boss.isAlive) {
    view.setUint8(offset, 1); offset += 1 // hasBoss = true
    view.setFloat32(offset, state.boss.position.x, true); offset += 4
    view.setFloat32(offset, state.boss.position.y, true); offset += 4
    view.setUint16(offset, state.boss.hp, true); offset += 2
    view.setUint16(offset, state.boss.maxHp, true); offset += 2
    view.setUint8(offset, state.boss.phase); offset += 1
    view.setFloat32(offset, state.boss.angle, true); offset += 4
    view.setUint8(offset, state.boss.isAlive ? 1 : 0); offset += 1

    // Laser angle (optional)
    if (state.boss.laserAngle !== undefined) {
      view.setUint8(offset, 1); offset += 1 // hasLaser = true
      view.setFloat32(offset, state.boss.laserAngle, true); offset += 4
    } else {
      view.setUint8(offset, 0); offset += 1 // hasLaser = false
      offset += 4 // skip laserAngle bytes
    }

    // Current attack (0 = null, 1-10 = attack types)
    view.setUint8(offset, state.boss.currentAttack ? bossAttackTypeToNumber(state.boss.currentAttack) : 0); offset += 1
  } else {
    view.setUint8(offset, 0); offset += 1 // hasBoss = false
  }

  // CTF state
  if (state.ctf) {
    view.setUint8(offset, 1); offset += 1 // hasCTF = true
    view.setFloat32(offset, state.ctf.flagA.x, true); offset += 4
    view.setFloat32(offset, state.ctf.flagA.y, true); offset += 4
    view.setFloat32(offset, state.ctf.flagB.x, true); offset += 4
    view.setFloat32(offset, state.ctf.flagB.y, true); offset += 4
    view.setUint8(offset, state.ctf.scoreA); offset += 1
    view.setUint8(offset, state.ctf.scoreB); offset += 1
    view.setUint16(offset, state.ctf.baseA.x, true); offset += 2
    view.setUint16(offset, state.ctf.baseA.y, true); offset += 2
    view.setUint16(offset, state.ctf.baseA.w, true); offset += 2
    view.setUint16(offset, state.ctf.baseA.h, true); offset += 2
    view.setUint16(offset, state.ctf.baseB.x, true); offset += 2
    view.setUint16(offset, state.ctf.baseB.y, true); offset += 2
    view.setUint16(offset, state.ctf.baseB.w, true); offset += 2
    view.setUint16(offset, state.ctf.baseB.h, true); offset += 2
    // CTF flags byte: bit0=flagADropped, bit1=flagBDropped
    let ctfFlags = 0
    if (state.ctf.flagADropped) ctfFlags |= 1
    if (state.ctf.flagBDropped) ctfFlags |= 2
    view.setUint8(offset, ctfFlags); offset += 1
  } else {
    view.setUint8(offset, 0); offset += 1 // hasCTF = false
  }

  return buffer
}

function bossAttackTypeToNumber(attack: string): number {
  const attacks = ['circularBarrage', 'fanShot', 'spiral', 'rotatingLaser', 'tripleShot', 'teleportExplosion', 'mineField', 'bulletWave', 'chaosFire', 'rageMode']
  const idx = attacks.indexOf(attack)
  return idx >= 0 ? idx + 1 : 0
}

function encodeTank(view: DataView, offset: number, tank: Tank, indexMap: IndexMap): number {
  const index = indexMap.getIndex(tank.id) ?? 0xFF

  // Flags: bit0=isAlive, bit1=isBot, bit2-3=team(00=none,01=A,10=B), bit4=hasFlag
  let flags = 0
  if (tank.isAlive) flags |= (1 << 0)
  if (tank.isBot) flags |= (1 << 1)
  if (tank.team === 'a') flags |= (1 << 2)
  else if (tank.team === 'b') flags |= (2 << 2)
  if (tank.hasFlag) flags |= (1 << 4)

  const colorIndex = TANK_COLORS.indexOf(tank.color)

  view.setUint8(offset, index); offset += 1
  view.setFloat32(offset, tank.position.x, true); offset += 4
  view.setFloat32(offset, tank.position.y, true); offset += 4
  view.setFloat32(offset, tank.hullAngle, true); offset += 4
  view.setFloat32(offset, tank.turretAngle, true); offset += 4
  view.setUint8(offset, tank.hp); offset += 1
  view.setUint8(offset, tank.maxHp); offset += 1
  view.setUint16(offset, tank.stars, true); offset += 2
  view.setUint16(offset, tank.kills, true); offset += 2
  view.setUint8(offset, flags); offset += 1
  view.setUint8(offset, colorIndex !== -1 ? colorIndex : 0); offset += 1
  view.setFloat32(offset, tank.powerUpEndTime, true); offset += 4
  view.setUint16(offset, tank.fireCooldown, true); offset += 2
  view.setFloat32(offset, tank.tankRadius, true); offset += 4

  return offset
}

function encodeBullet(view: DataView, offset: number, bullet: Bullet, indexMap: IndexMap): number {
  const ownerIndex = indexMap.getIndex(bullet.ownerId) ?? 0xFF

  view.setUint8(offset, ownerIndex); offset += 1
  view.setFloat32(offset, bullet.position.x, true); offset += 4
  view.setFloat32(offset, bullet.position.y, true); offset += 4
  view.setFloat32(offset, bullet.angle, true); offset += 4
  // Pack isRocket flag into bit 7 of distance byte (distance is 0-127)
  const distByte = Math.min(127, Math.round(bullet.distanceTraveled)) | (bullet.isRocket ? 0x80 : 0)
  view.setUint8(offset, distByte); offset += 1

  return offset
}

function encodeLeaderboardEntry(view: DataView, offset: number, entry: LeaderboardEntry, indexMap: IndexMap): number {
  const index = indexMap.getIndex(entry.id) ?? 0xFF

  let flags = 0
  if (entry.isAlive) flags |= (1 << 0)

  view.setUint8(offset, index); offset += 1
  view.setUint16(offset, entry.kills, true); offset += 2
  view.setUint16(offset, entry.stars, true); offset += 2
  view.setUint8(offset, flags); offset += 1

  return offset
}

export function encodeLeaderboard(entries: LeaderboardEntry[], indexMap: IndexMap): ArrayBuffer {
  const entryCount = entries.length
  const size = 2 + (entryCount * LEADERBOARD_ENTRY_SIZE)
  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  let offset = 0

  view.setUint8(offset, MSG_LEADERBOARD); offset += 1
  view.setUint8(offset, entryCount); offset += 1

  for (const entry of entries) {
    offset = encodeLeaderboardEntry(view, offset, entry, indexMap)
  }

  return buffer
}

export function encodeKillEvent(deadIndex: number, killerIndex: number): ArrayBuffer {
  const buffer = new ArrayBuffer(3)
  const view = new DataView(buffer)
  view.setUint8(0, MSG_KILL)
  view.setUint8(1, deadIndex)
  view.setUint8(2, killerIndex === -1 ? 0xFF : killerIndex)
  return buffer
}

export function encodePortalExitEvent(playerIndex: number, stars: number): ArrayBuffer {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint8(0, MSG_PORTAL_EXIT)
  view.setUint8(1, playerIndex)
  view.setUint16(2, stars, true)
  return buffer
}
