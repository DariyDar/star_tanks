import { GameState, Tank } from '../types.js'
import { IndexMap } from './IndexMap.js'
import {
  MSG_DELTA_STATE,
  TANK_DATA_SIZE,
  directionToNumber,
  powerUpToNumber
} from './BinaryProtocol.js'

/**
 * Encodes delta (changes only) between two game states
 * Only sends entities that changed since last state
 */
export function encodeDeltaState(
  currentState: GameState,
  previousState: GameState | null,
  indexMap: IndexMap
): ArrayBuffer | null {
  if (!previousState) {
    return null  // No previous state, must send full state
  }

  // Calculate what changed
  const changedTanks: Tank[] = []
  const tankMap = new Map(previousState.tanks.map(t => [t.id, t]))

  for (const tank of currentState.tanks) {
    const prev = tankMap.get(tank.id)
    if (!prev || hasTankChanged(tank, prev)) {
      changedTanks.push(tank)
    }
  }

  // For now, if more than 50% changed, send full state instead
  // Delta is only beneficial when changes are sparse
  if (changedTanks.length > currentState.tanks.length * 0.5) {
    return null
  }

  // Build delta packet
  // Header: type(1) + tick(4) + tankCount(1)
  const headerSize = 6
  const dataSize = changedTanks.length * (1 + 20)  // tankIndex + partial tank data

  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)
  let offset = 0

  // Header
  view.setUint8(offset, MSG_DELTA_STATE); offset += 1
  view.setUint32(offset, currentState.tick, true); offset += 4
  view.setUint8(offset, changedTanks.length); offset += 1

  // Changed tanks (only position, hp, direction, stars)
  for (const tank of changedTanks) {
    const index = indexMap.getIndex(tank.id)
    if (index === undefined) continue

    view.setUint8(offset, index); offset += 1
    view.setUint16(offset, Math.round(tank.position.x * 10), true); offset += 2
    view.setUint16(offset, Math.round(tank.position.y * 10), true); offset += 2
    view.setUint8(offset, directionToNumber(tank.direction)); offset += 1
    view.setUint8(offset, tank.hp); offset += 1
    view.setUint16(offset, tank.stars, true); offset += 2

    // Flags for powerup
    let flags = 0
    if (tank.activePowerUp) {
      flags |= (1 << 0)
      flags |= (powerUpToNumber(tank.activePowerUp) << 1)
    }
    view.setUint8(offset, flags); offset += 1

    view.setUint8(offset, tank.isAlive ? 1 : 0); offset += 1
  }

  return buffer
}

/**
 * Check if tank has changed enough to warrant sending in delta
 */
function hasTankChanged(current: Tank, previous: Tank): boolean {
  // Position changed significantly (more than 0.1 cells)
  if (Math.abs(current.position.x - previous.position.x) > 0.1 ||
      Math.abs(current.position.y - previous.position.y) > 0.1) {
    return true
  }

  // Direction changed
  if (current.direction !== previous.direction) {
    return true
  }

  // HP changed
  if (current.hp !== previous.hp) {
    return true
  }

  // Stars changed
  if (current.stars !== previous.stars) {
    return true
  }

  // Alive status changed
  if (current.isAlive !== previous.isAlive) {
    return true
  }

  // PowerUp changed
  if (current.activePowerUp !== previous.activePowerUp) {
    return true
  }

  return false
}
