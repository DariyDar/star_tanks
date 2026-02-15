import { GameState, Tank } from '../types.js'
import type { TankMeta } from './BinaryDecoder.js'
import {
  MSG_DELTA_STATE,
  numberToDirection,
  numberToPowerUp
} from './BinaryProtocol.js'

/**
 * Applies delta updates to existing game state
 */
export function applyDeltaState(
  buffer: ArrayBuffer,
  currentState: GameState,
  tankMetaMap: Map<number, TankMeta>
): GameState | null {
  const view = new DataView(buffer)
  let offset = 0

  // Verify message type
  const msgType = view.getUint8(offset); offset += 1
  if (msgType !== MSG_DELTA_STATE) {
    return null
  }

  // Read header
  const tick = view.getUint32(offset, true); offset += 4
  const changedTankCount = view.getUint8(offset); offset += 1

  // Clone current state to apply deltas
  const newState = { ...currentState, tick }
  const tankMap = new Map(newState.tanks.map(t => [t.id, t]))

  // Apply tank deltas
  for (let i = 0; i < changedTankCount; i++) {
    const tankIndex = view.getUint8(offset); offset += 1
    const meta = tankMetaMap.get(tankIndex)
    if (!meta) continue

    const tank = tankMap.get(meta.id)
    if (!tank) continue

    // Update tank with delta data
    tank.position.x = view.getUint16(offset, true) / 10; offset += 2
    tank.position.y = view.getUint16(offset, true) / 10; offset += 2
    tank.direction = numberToDirection(view.getUint8(offset)); offset += 1
    tank.hp = view.getUint8(offset); offset += 1
    tank.stars = view.getUint16(offset, true); offset += 2

    // Flags
    const flags = view.getUint8(offset); offset += 1
    const hasPowerUp = (flags & (1 << 0)) !== 0
    if (hasPowerUp) {
      const powerUpType = (flags >> 1) & 0x03
      tank.activePowerUp = numberToPowerUp(powerUpType)
    } else {
      tank.activePowerUp = null
    }

    tank.isAlive = view.getUint8(offset) === 1; offset += 1
  }

  return newState
}
