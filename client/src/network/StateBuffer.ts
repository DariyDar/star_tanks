import type { GameState } from '@shared/types.js'
import { lerp, lerpAngle } from '@shared/math.js'

// Use client-side receive time for interpolation (avoids clock sync issues)
interface TimedState {
  state: GameState
  receiveTime: number  // Client-side Date.now() when state was received
}

const INTERPOLATION_BUFFER_MS = 100 // Render 100ms behind latest to allow smooth interpolation

export class StateBuffer {
  private buffer: TimedState[] = []
  private maxSize = 30

  push(state: GameState): void {
    this.buffer.push({
      state,
      receiveTime: Date.now()
    })
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getInterpolatedState(): GameState | null {
    if (this.buffer.length === 0) return null
    if (this.buffer.length === 1) return this.buffer[0].state

    const renderTime = Date.now() - INTERPOLATION_BUFFER_MS
    let prev: TimedState | null = null
    let next: TimedState | null = null

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].receiveTime <= renderTime && this.buffer[i + 1].receiveTime >= renderTime) {
        prev = this.buffer[i]
        next = this.buffer[i + 1]
        break
      }
    }

    if (!prev || !next) {
      // If renderTime is ahead of all states, use latest
      return this.buffer[this.buffer.length - 1].state
    }

    const t = (renderTime - prev.receiveTime) / (next.receiveTime - prev.receiveTime)

    // Interpolate tank positions and angles
    const interpolatedTanks = next.state.tanks.map(nextTank => {
      const prevTank = prev!.state.tanks.find(pt => pt.id === nextTank.id)
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
    const interpolatedBullets = next.state.bullets.map(nextBullet => {
      const prevBullet = prev!.state.bullets.find(pb => pb.id === nextBullet.id)
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
      ...next.state,
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
