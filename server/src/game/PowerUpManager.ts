import { type PowerUp, type Tank, type Vec2, PowerUpType } from '@tank-br/shared/types.js'
import {
  POWERUP_SPAWN_INTERVAL, POWERUP_DURATION, POWERUP_LIFETIME, SPEED_MULTIPLIER,
  FIRE_COOLDOWN_RAPID, MAX_POWERUPS
} from '@tank-br/shared/constants.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'
import { SpatialGrid, isWalkableCell } from '@tank-br/shared/collision.js'

let powerUpIdCounter = 0

// Weighted powerup pool - Heal appears most often
const POWER_UP_TYPES = [
  PowerUpType.RapidFire,
  PowerUpType.Speed,
  PowerUpType.Shield,
  PowerUpType.Magnet,
  PowerUpType.OpticalSight,
  PowerUpType.Rocket,
  PowerUpType.Heal,
  PowerUpType.Heal,
  PowerUpType.Heal,
  PowerUpType.Heal   // Heal is 4 out of 10 (40% chance)
]

export class PowerUpManager {
  private powerUps: PowerUp[] = []
  private lastSpawnTime = 0
  private rng: () => number
  private mapWidth: number
  private mapHeight: number
  private grid: SpatialGrid | null = null

  constructor(mapWidth: number, mapHeight: number) {
    this.rng = createRng(Date.now())
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  setGrid(grid: SpatialGrid): void {
    this.grid = grid
  }

  update(tanks: Tank[], now: number, isPositionSafe?: (x: number, y: number) => boolean): void {
    // Spawn new power-up
    if (now - this.lastSpawnTime >= POWERUP_SPAWN_INTERVAL) {
      this.spawnPowerUp(now, isPositionSafe)
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

  private spawnPowerUp(now: number, isPositionSafe?: (x: number, y: number) => boolean): void {
    // Try to find a safe position within the zone
    let x: number, y: number
    let foundSafe = false

    for (let attempt = 0; attempt < 50; attempt++) {
      x = rngInt(this.rng, 100, this.mapWidth - 100)
      y = rngInt(this.rng, 100, this.mapHeight - 100)

      // Check zone safety AND walkable terrain
      const zoneSafe = !isPositionSafe || isPositionSafe(x, y)
      const terrainSafe = !this.grid || isWalkableCell(Math.floor(x), Math.floor(y), this.grid, this.mapWidth, this.mapHeight)
      if (zoneSafe && terrainSafe) {
        foundSafe = true
        break
      }
    }

    // If we couldn't find a safe position after 50 attempts, don't spawn
    if (isPositionSafe && !foundSafe) {
      return
    }

    const type = POWER_UP_TYPES[rngInt(this.rng, 0, POWER_UP_TYPES.length - 1)]

    this.powerUps.push({
      id: `pu_${powerUpIdCounter++}`,
      type,
      position: { x: x!, y: y! },
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

  addPowerUp(powerUp: PowerUp): void {
    // Ensure powerup doesn't land on impassable terrain
    if (this.grid) {
      const cx = Math.floor(powerUp.position.x)
      const cy = Math.floor(powerUp.position.y)
      if (!isWalkableCell(cx, cy, this.grid, this.mapWidth, this.mapHeight)) {
        // Try nearby positions in a spiral
        for (let r = 1; r <= 3; r++) {
          for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
              if (isWalkableCell(cx + dx, cy + dy, this.grid, this.mapWidth, this.mapHeight)) {
                powerUp.position = { x: cx + dx + 0.5, y: cy + dy + 0.5 }
                this.powerUps.push(powerUp)
                return
              }
            }
          }
        }
        return // Can't find walkable spot, skip this powerup
      }
    }
    this.powerUps.push(powerUp)
  }

  getPowerUps(): PowerUp[] {
    return this.powerUps
  }
}
