import { type PowerUp, type Tank, type Vec2, PowerUpType } from '@tank-br/shared/types.js'
import {
  POWERUP_SPAWN_INTERVAL, POWERUP_DURATION, SPEED_MULTIPLIER,
  FIRE_COOLDOWN_RAPID
} from '@tank-br/shared/constants.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'

let powerUpIdCounter = 0

const POWER_UP_TYPES = [PowerUpType.RapidFire, PowerUpType.Speed, PowerUpType.Shield]

export class PowerUpManager {
  private powerUps: PowerUp[] = []
  private lastSpawnTime = 0
  private rng: () => number
  private mapWidth: number
  private mapHeight: number

  constructor(mapWidth: number, mapHeight: number) {
    this.rng = createRng(Date.now())
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  update(tanks: Tank[], now: number): void {
    // Spawn new power-up
    if (now - this.lastSpawnTime >= POWERUP_SPAWN_INTERVAL) {
      this.spawnPowerUp(now)
      this.lastSpawnTime = now
    }

    // Check collection
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i]
      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (
          Math.round(tank.position.x) === pu.position.x &&
          Math.round(tank.position.y) === pu.position.y
        ) {
          this.applyPowerUp(tank, pu, now)
          this.powerUps.splice(i, 1)
          break
        }
      }
    }
  }

  private spawnPowerUp(now: number): void {
    const x = rngInt(this.rng, 100, this.mapWidth - 100)
    const y = rngInt(this.rng, 100, this.mapHeight - 100)
    const type = POWER_UP_TYPES[rngInt(this.rng, 0, POWER_UP_TYPES.length - 1)]

    this.powerUps.push({
      id: `pu_${powerUpIdCounter++}`,
      type,
      position: { x, y },
      spawnedAt: now
    })

    // Keep max 5 power-ups on map
    if (this.powerUps.length > 5) {
      this.powerUps.shift()
    }
  }

  private applyPowerUp(tank: Tank, powerUp: PowerUp, now: number): void {
    tank.activePowerUp = powerUp.type
    tank.powerUpEndTime = now + POWERUP_DURATION

    if (powerUp.type === PowerUpType.Speed) {
      tank.speed *= SPEED_MULTIPLIER
    }
  }

  getPowerUps(): PowerUp[] {
    return this.powerUps
  }
}
