import type { GameState } from '@shared/types.js'
import { INTERPOLATION_DELAY } from '@shared/constants.js'
import { lerp, lerpAngle } from '@shared/math.js'

export class StateBuffer {
  private buffer: GameState[] = []
  private maxSize = 30

  push(state: GameState): void {
    this.buffer.push(state)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getInterpolatedState(): GameState | null {
    if (this.buffer.length === 0) return null
    if (this.buffer.length === 1) return this.buffer[0]

    const renderTime = Date.now() - INTERPOLATION_DELAY
    let prev: GameState | null = null
    let next: GameState | null = null

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime && this.buffer[i + 1].timestamp >= renderTime) {
        prev = this.buffer[i]
        next = this.buffer[i + 1]
        break
      }
    }

    if (!prev || !next) {
      return this.buffer[this.buffer.length - 1]
    }

    const t = (renderTime - prev.timestamp) / (next.timestamp - prev.timestamp)

    // Interpolate tank positions and angles
    const interpolatedTanks = next.tanks.map(nextTank => {
      const prevTank = prev!.tanks.find(pt => pt.id === nextTank.id)
      if (!prevTank) return nextTank

      return {
        ...nextTank,
        position: {
          x: lerp(prevTank.position.x, nextTank.position.x, t),
          y: lerp(prevTank.position.y, nextTank.position.y, t)
        },
        hullAngle: lerpAngle(prevTank.hullAngle, nextTank.hullAngle, t),
        turretAngle: lerpAngle(prevTank.turretAngle, nextTank.turretAngle, t)
      }
    })

    // Interpolate bullet positions
    const interpolatedBullets = next.bullets.map(nextBullet => {
      const prevBullet = prev!.bullets.find(pb => pb.id === nextBullet.id)
      if (!prevBullet) return nextBullet

      return {
        ...nextBullet,
        position: {
          x: lerp(prevBullet.position.x, nextBullet.position.x, t),
          y: lerp(prevBullet.position.y, nextBullet.position.y, t)
        }
      }
    })

    return {
      ...next,
      tanks: interpolatedTanks,
      bullets: interpolatedBullets
    }
  }

  clear(): void {
    this.buffer = []
  }

  get size(): number {
    return this.buffer.length
  }
}
