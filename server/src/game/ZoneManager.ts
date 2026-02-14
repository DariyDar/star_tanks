import type { Zone, Tank } from '../../../shared/src/types.js'
import {
  ZONE_SHRINK_START, ZONE_SHRINK_PHASES, ZONE_DAMAGE_PER_SECOND,
  ZONE_PAUSE_BETWEEN, TICK_MS
} from '../../../shared/src/constants.js'
import { distance } from '../../../shared/src/math.js'

export class ZoneManager {
  private zone: Zone

  constructor(mapWidth: number, mapHeight: number) {
    const maxRadius = Math.max(mapWidth, mapHeight)
    this.zone = {
      centerX: Math.floor(mapWidth / 2),
      centerY: Math.floor(mapHeight / 2),
      currentRadius: maxRadius,
      targetRadius: maxRadius,
      shrinkSpeed: 0,
      phase: 0,
      isShrinking: false,
      nextShrinkAt: ZONE_SHRINK_START
    }
  }

  update(tanks: Tank[], elapsed: number, now: number): void {
    // Phase 0 = not started yet
    if (elapsed < ZONE_SHRINK_START) return

    const maxRadius = this.zone.currentRadius

    // Start next shrink phase
    if (!this.zone.isShrinking && this.zone.phase < ZONE_SHRINK_PHASES && elapsed >= this.zone.nextShrinkAt) {
      this.zone.phase++
      this.zone.isShrinking = true
      // Each phase shrinks to a smaller radius
      const fraction = 1 - (this.zone.phase / ZONE_SHRINK_PHASES)
      this.zone.targetRadius = Math.max(0, Math.max(this.zone.centerX, this.zone.centerY) * 2 * fraction)
      // Shrink over 30 seconds
      this.zone.shrinkSpeed = (this.zone.currentRadius - this.zone.targetRadius) / (30000 / TICK_MS)
    }

    // Shrink
    if (this.zone.isShrinking) {
      this.zone.currentRadius = Math.max(
        this.zone.targetRadius,
        this.zone.currentRadius - this.zone.shrinkSpeed
      )

      if (this.zone.currentRadius <= this.zone.targetRadius) {
        this.zone.isShrinking = false
        this.zone.nextShrinkAt = elapsed + ZONE_PAUSE_BETWEEN
      }
    }

    // Damage tanks outside zone
    for (const tank of tanks) {
      if (!tank.isAlive) continue
      const dist = distance(
        { x: tank.position.x, y: tank.position.y },
        { x: this.zone.centerX, y: this.zone.centerY }
      )
      if (dist > this.zone.currentRadius) {
        // Damage per tick = damage_per_second * tick_interval
        tank.hp -= ZONE_DAMAGE_PER_SECOND * (TICK_MS / 1000)
      }
    }
  }

  getZone(): Zone {
    return this.zone
  }

  isFullyShrunk(): boolean {
    return this.zone.currentRadius <= 0
  }
}
