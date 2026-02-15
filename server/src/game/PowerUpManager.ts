import { type PowerUp, type Tank, type Vec2, PowerUpType } from '@tank-br/shared/types.js'
import {
  POWERUP_SPAWN_INTERVAL, POWERUP_DURATION, POWERUP_LIFETIME, SPEED_MULTIPLIER,
  FIRE_COOLDOWN_RAPID, MAX_POWERUPS
} from '@tank-br/shared/constants.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'

let powerUpIdCounter = 0

// Weighted powerup pool - Heal appears 3x more often than others
const POWER_UP_TYPES = [
  PowerUpType.RapidFire,
  PowerUpType.Speed,
  PowerUpType.Shield,
  PowerUpType.Magnet,
  PowerUpType.Heal,
  PowerUpType.Heal,  // Extra Heal for more healing
  PowerUpType.Heal   // Extra Heal for more healing
]

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

    // Remove expired powerups and check collection
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i]

      // Remove if expired (30 seconds on map)
      if (now - pu.spawnedAt >= POWERUP_LIFETIME) {
        this.powerUps.splice(i, 1)
        continue
      }

      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (tank.isBot) continue  // Боты не собирают бонусы

        // Радиус притяжения
        const magnetRadius = tank.magnetRadius ?? 1
        const dx = tank.position.x - pu.position.x
        const dy = tank.position.y - pu.position.y
        const distSq = dx * dx + dy * dy

        if (distSq <= magnetRadius * magnetRadius) {
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

    // Keep max power-ups on map
    if (this.powerUps.length > MAX_POWERUPS) {
      this.powerUps.shift()
    }
  }

  private applyPowerUp(tank: Tank, powerUp: PowerUp, now: number): void {
    if (powerUp.type === PowerUpType.Heal) {
      // Heal is instant, not a timed powerup
      tank.hp = Math.min(tank.hp + 2, tank.maxHp)
      return
    }

    tank.activePowerUp = powerUp.type
    tank.powerUpEndTime = now + POWERUP_DURATION

    if (powerUp.type === PowerUpType.Speed) {
      tank.speed *= SPEED_MULTIPLIER
    } else if (powerUp.type === PowerUpType.Magnet) {
      // Увеличиваем радиус притяжения до максимума 4
      tank.magnetRadius = Math.min(tank.magnetRadius + 1, 4)
    }
  }

  getPowerUps(): PowerUp[] {
    return this.powerUps
  }
}
