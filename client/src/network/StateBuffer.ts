import type { GameState, Tank, Bullet } from '@shared/types.js'
import { lerp, lerpAngle } from '@shared/math.js'

// Use client-side receive time for interpolation (avoids clock sync issues)
interface TimedState {
  state: GameState
  receiveTime: number  // Client-side Date.now() when state was received
  tankMap: Map<string, Tank>    // Pre-built for O(1) lookup
  bulletMap: Map<string, Bullet> // Pre-built for O(1) lookup
}

const INTERPOLATION_BUFFER_MS = 80 // Render 80ms behind latest
const TELEPORT_THRESHOLD_SQ = 25  // 5 cells squared — skip lerp if tank jumps further

export interface DebugInfo {
  mode: 'interpolating' | 'extrapolating' | 'waiting' | 'single'
  bufferSize: number
  packetGapMs: number  // gap between last 2 packets
  extrapolateMs: number  // how far ahead we're extrapolating
}

export class StateBuffer {
  private buffer: TimedState[] = []
  private maxSize = 30
  debugInfo: DebugInfo = { mode: 'waiting', bufferSize: 0, packetGapMs: 0, extrapolateMs: 0 }

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
    if (this.buffer.length === 0) { this.debugInfo.mode = 'waiting'; this.debugInfo.bufferSize = 0; return null }
    if (this.buffer.length === 1) { this.debugInfo.mode = 'single'; this.debugInfo.bufferSize = 1; return this.buffer[0].state }

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
        this.debugInfo = { mode: 'extrapolating', bufferSize: this.buffer.length, packetGapMs: gap, extrapolateMs: renderTime - b.receiveTime }
        if (gap > 0) {
          const elapsed = renderTime - b.receiveTime
          // Clamp extrapolation to max 150ms to avoid overshooting
          const t = Math.min(elapsed / gap, 1.5)
          if (t > 0) {
            const extraTanks = b.state.tanks.map(bTank => {
              const aTank = a.tankMap.get(bTank.id)
              if (!aTank) return bTank
              // Skip extrapolation on respawn or teleport
              if (!aTank.isAlive && bTank.isAlive) return bTank
              const ddx = bTank.position.x - aTank.position.x
              const ddy = bTank.position.y - aTank.position.y
              if (ddx * ddx + ddy * ddy > TELEPORT_THRESHOLD_SQ) return bTank
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
            // Extrapolate bullet positions too (instead of showing stale positions)
            const extraBullets = b.state.bullets.map(bBullet => {
              const aBullet = a.bulletMap.get(bBullet.id)
              if (!aBullet) return bBullet
              return {
                ...bBullet,
                position: {
                  x: bBullet.position.x + (bBullet.position.x - aBullet.position.x) * t,
                  y: bBullet.position.y + (bBullet.position.y - aBullet.position.y) * t
                }
              }
            })
            return { ...b.state, tanks: extraTanks, bullets: extraBullets }
          }
        }
      }
      return this.buffer[this.buffer.length - 1].state
    }

    this.debugInfo = { mode: 'interpolating', bufferSize: this.buffer.length, packetGapMs: next.receiveTime - prev.receiveTime, extrapolateMs: 0 }
    const rawT = (renderTime - prev.receiveTime) / (next.receiveTime - prev.receiveTime)
    // Smoothstep for smoother transitions between packets (reduces jitter)
    const t = rawT * rawT * (3 - 2 * rawT)

    // Interpolate tank positions and angles — O(1) lookup via Map
    const interpolatedTanks = next.state.tanks.map(nextTank => {
      const prevTank = prev!.tankMap.get(nextTank.id)
      if (!prevTank) return nextTank

      // Skip interpolation on respawn (dead→alive) or teleport (large position jump)
      if (!prevTank.isAlive && nextTank.isAlive) return nextTank
      const dx = nextTank.position.x - prevTank.position.x
      const dy = nextTank.position.y - prevTank.position.y
      if (dx * dx + dy * dy > TELEPORT_THRESHOLD_SQ) return nextTank

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

    // Bullets: skip interpolation — they move fast & linearly,
    // lerping causes phantom artifacts when bullets appear/disappear between states
    return {
      ...next.state,
      tanks: interpolatedTanks
    }
  }

  clear(): void {
    this.buffer = []
  }

  get size(): number {
    return this.buffer.length
  }
}
