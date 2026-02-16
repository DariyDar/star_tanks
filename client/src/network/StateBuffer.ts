import type { GameState, Tank, Bullet } from '@shared/types.js'
import { lerp, lerpAngle } from '@shared/math.js'

// Use client-side receive time for interpolation (avoids clock sync issues)
interface TimedState {
  state: GameState
  receiveTime: number  // Client-side Date.now() when state was received
  tankMap: Map<string, Tank>    // Pre-built for O(1) lookup
  bulletMap: Map<string, Bullet> // Pre-built for O(1) lookup
}

const INTERPOLATION_BUFFER_MS = 100 // Render 100ms behind latest to allow smooth interpolation

export class StateBuffer {
  private buffer: TimedState[] = []
  private maxSize = 30

  push(state: GameState): void {
    // Pre-build Maps for O(1) lookup during interpolation
    const tankMap = new Map<string, Tank>()
    for (const t of state.tanks) tankMap.set(t.id, t)
    const bulletMap = new Map<string, Bullet>()
    for (const b of state.bullets) bulletMap.set(b.id, b)

    this.buffer.push({ state, receiveTime: Date.now(), tankMap, bulletMap })
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
      // If renderTime is ahead of all states, extrapolate from last two
      if (this.buffer.length >= 2) {
        const a = this.buffer[this.buffer.length - 2]
        const b = this.buffer[this.buffer.length - 1]
        const gap = b.receiveTime - a.receiveTime
        if (gap > 0) {
          const elapsed = renderTime - b.receiveTime
          // Clamp extrapolation to max 150ms to avoid overshooting
          const t = Math.min(elapsed / gap, 1.5)
          if (t > 0) {
            const extraTanks = b.state.tanks.map(bTank => {
              const aTank = a.tankMap.get(bTank.id)
              if (!aTank) return bTank
              return {
                ...bTank,
                position: {
                  x: bTank.position.x + (bTank.position.x - aTank.position.x) * t,
                  y: bTank.position.y + (bTank.position.y - aTank.position.y) * t
                },
                hullAngle: lerpAngle(aTank.hullAngle, bTank.hullAngle, 1 + t),
                turretAngle: lerpAngle(aTank.turretAngle, bTank.turretAngle, 1 + t)
              }
            })
            return { ...b.state, tanks: extraTanks }
          }
        }
      }
      return this.buffer[this.buffer.length - 1].state
    }

    const t = (renderTime - prev.receiveTime) / (next.receiveTime - prev.receiveTime)

    // Interpolate tank positions and angles — O(1) lookup via Map
    const interpolatedTanks = next.state.tanks.map(nextTank => {
      const prevTank = prev!.tankMap.get(nextTank.id)
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

    // Interpolate bullet positions — O(1) lookup via Map
    const interpolatedBullets = next.state.bullets.map(nextBullet => {
      const prevBullet = prev!.bulletMap.get(nextBullet.id)
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
