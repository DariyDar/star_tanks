import { TICK_MS } from '../../../shared/src/constants.js'

export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private tick = 0

  constructor(private readonly onTick: (tick: number, deltaMs: number) => void) {}

  start(): void {
    if (this.intervalId) return
    this.tick = 0

    this.intervalId = setInterval(() => {
      this.tick++
      this.onTick(this.tick, TICK_MS)
    }, TICK_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  get currentTick(): number {
    return this.tick
  }

  get isRunning(): boolean {
    return this.intervalId !== null
  }
}
