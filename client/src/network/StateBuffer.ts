import type { GameState } from '@shared/types.js'
import { INTERPOLATION_DELAY } from '@shared/constants.js'

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

    // For grid-based movement, interpolation is simple: use the latest state
    // Tanks snap to grid cells, so smooth interpolation isn't needed
    const t = (renderTime - prev.timestamp) / (next.timestamp - prev.timestamp)
    return t > 0.5 ? next : prev
  }

  clear(): void {
    this.buffer = []
  }

  get size(): number {
    return this.buffer.length
  }
}
