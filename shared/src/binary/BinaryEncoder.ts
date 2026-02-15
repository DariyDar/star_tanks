import type { GameState } from '../types.js'
import { TANK_DATA_SIZE, HEADER_SIZE, ZONE_SIZE, MSG_FULL_STATE } from './BinaryProtocol.js'
import type IndexMap from './IndexMap.js'

function writeStringFixed(view: DataView, offset: number, str: string, maxLen: number) {
  for (let i = 0; i < maxLen; i++) {
    const code = i < str.length ? str.charCodeAt(i) : 0
    view.setUint8(offset + i, code)
  }
}

export function encodeFullState(state: GameState, indexMap: IndexMap): ArrayBuffer {
  const tankCount = state.tanks.length
  const header = HEADER_SIZE + ZONE_SIZE + 1 // + tankCount byte
  const tanksSize = tankCount * TANK_DATA_SIZE
  const bulletsSize = 0
  const rest = 4 // placeholder for star bitfield

  const total = header + tanksSize + bulletsSize + rest
  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)

  let off = 0
  view.setUint8(off, MSG_FULL_STATE); off += 1
  view.setUint32(off, state.tick); off += 4
  view.setFloat32(off, state.timestamp); off += 4
  // phase
  view.setUint8(off, typeof state.phase === 'number' ? state.phase : 0); off += 1
  view.setUint8(off, state.playersAlive); off += 1
  view.setFloat32(off, state.timeElapsed); off += 4

  // Zone (write some basic fields)
  const z = state.zone
  view.setUint16(off, Math.round(z.centerX)); off += 2
  view.setUint16(off, Math.round(z.centerY)); off += 2
  view.setFloat32(off, z.currentRadius); off += 4
  view.setFloat32(off, z.targetRadius); off += 4
  view.setUint8(off, z.isShrinking ? 1 : 0); off += 1
  view.setUint8(off, z.phase); off += 1
  view.setFloat32(off, z.nextShrinkAt); off += 4

  // Tanks
  view.setUint8(off, tankCount); off += 1
  for (const tank of state.tanks) {
    const idx = indexMap.getIndex(tank.id)
    view.setUint8(off, idx >= 0 ? idx : 255); off += 1
    view.setFloat32(off, tank.position.x); off += 4
    view.setFloat32(off, tank.position.y); off += 4
    // direction -> uint8 (map strings to 0-3)
    const dirMap: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 }
    const d = (dirMap as any)[tank.direction as any] ?? 0
    view.setUint8(off, d); off += 1
    view.setUint8(off, tank.hp); off += 1
    view.setUint8(off, tank.maxHp); off += 1
    view.setUint16(off, tank.stars); off += 2
    view.setUint16(off, tank.kills); off += 2
    let flags = 0
    if (tank.isBot) flags |= 1
    if (tank.isAlive) flags |= 2
    if (tank.activePowerUp === 'shield') flags |= 4
    view.setUint8(off, flags); off += 1
    // color index placeholder
    view.setUint8(off, 0); off += 1
    view.setFloat32(off, tank.powerUpEndTime || 0); off += 4
    view.setUint16(off, tank.fireCooldown || 0); off += 2
  }

  // star bits placeholder
  view.setUint32(off, 0); off += 4

  return buffer
}

export default { encodeFullState }
