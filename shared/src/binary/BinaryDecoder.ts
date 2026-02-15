import { MSG_FULL_STATE } from './BinaryProtocol.js'

export function decode(buffer: ArrayBuffer): any {
  const view = new DataView(buffer)
  let off = 0
  const msg = view.getUint8(off); off += 1
  if (msg === MSG_FULL_STATE) {
    const tick = view.getUint32(off); off += 4
    const timestamp = view.getFloat32(off); off += 4
    const phase = view.getUint8(off); off += 1
    const playersAlive = view.getUint8(off); off += 1
    const timeElapsed = view.getFloat32(off); off += 4

    // skip zone fields for simplicity
    off += 18

    const tankCount = view.getUint8(off); off += 1
    const tanks = []
    for (let i = 0; i < tankCount; i++) {
      const index = view.getUint8(off); off += 1
      const x = view.getFloat32(off); off += 4
      const y = view.getFloat32(off); off += 4
      const dir = view.getUint8(off); off += 1
      const hp = view.getUint8(off); off += 1
      const maxHp = view.getUint8(off); off += 1
      const stars = view.getUint16(off); off += 2
      const kills = view.getUint16(off); off += 2
      const flags = view.getUint8(off); off += 1
      const colorIndex = view.getUint8(off); off += 1
      const powerUpEnd = view.getFloat32(off); off += 4
      const fireCooldown = view.getUint16(off); off += 2
      tanks.push({ index, x, y, dir, hp, maxHp, stars, kills, flags, colorIndex, powerUpEnd, fireCooldown })
    }

    return { type: 'full', tick, timestamp, phase, playersAlive, timeElapsed, tanks }
  }

  return { type: 'unknown' }
}

export default { decode }
