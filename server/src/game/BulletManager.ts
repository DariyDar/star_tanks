import {
  type Bullet, type Tank, PowerUpType
} from '@tank-br/shared/types.js'
import {
  angleToVec
} from '@tank-br/shared/math.js'
import {
  SpatialGrid, isBlockingBullet, isDestructible
} from '@tank-br/shared/collision.js'
import {
  BULLET_SPEED, BULLET_RANGE, FIRE_COOLDOWN, FIRE_COOLDOWN_RAPID,
  TICK_MS
} from '@tank-br/shared/constants.js'

const BULLET_HIT_BUFFER = 0.15  // Extra buffer for bullet hit detection

export interface BulletHit {
  bullet: Bullet
  type: 'tank' | 'obstacle'
  targetId: string
}

let bulletIdCounter = 0

export class BulletManager {
  private bullets: Bullet[] = []

  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {}

  tryFire(tank: Tank, now: number): Bullet | null {
    if (!tank.isAlive) return null

    const cooldown = tank.activePowerUp === PowerUpType.RapidFire
      ? FIRE_COOLDOWN_RAPID
      : FIRE_COOLDOWN

    if (now - tank.lastFireTime < cooldown) return null

    tank.lastFireTime = now

    const vec = angleToVec(tank.turretAngle)
    const bullet: Bullet = {
      id: `b_${bulletIdCounter++}`,
      ownerId: tank.id,
      position: {
        x: tank.position.x + vec.x,
        y: tank.position.y + vec.y
      },
      angle: tank.turretAngle,
      distanceTraveled: 0
    }

    this.bullets.push(bullet)
    return bullet
  }

  update(tanks: Tank[]): BulletHit[] {
    const hits: BulletHit[] = []
    const cellsPerTick = BULLET_SPEED * (TICK_MS / 1000)
    const toRemove = new Set<string>()

    for (const bullet of this.bullets) {
      const vec = angleToVec(bullet.angle)
      const steps = Math.ceil(cellsPerTick)
      const stepSize = cellsPerTick / steps

      for (let step = 0; step < steps; step++) {
        bullet.position = {
          x: bullet.position.x + vec.x * stepSize,
          y: bullet.position.y + vec.y * stepSize
        }
        bullet.distanceTraveled += stepSize

        if (
          bullet.position.x < 0 || bullet.position.x >= this.mapWidth ||
          bullet.position.y < 0 || bullet.position.y >= this.mapHeight
        ) {
          toRemove.add(bullet.id)
          break
        }

        if (bullet.distanceTraveled >= BULLET_RANGE) {
          toRemove.add(bullet.id)
          break
        }

        const obs = this.grid.getAt(
          Math.floor(bullet.position.x),
          Math.floor(bullet.position.y)
        )
        if (obs && isBlockingBullet(obs.type)) {
          toRemove.add(bullet.id)
          if (isDestructible(obs.type)) {
            obs.hp -= 1
            if (obs.hp <= 0) {
              this.grid.remove(obs)
            }
          }
          break
        }

        const hitTank = this.findTankHit(bullet, tanks)
        if (hitTank) {
          hits.push({
            bullet,
            type: 'tank',
            targetId: hitTank.id
          })
          toRemove.add(bullet.id)
          break
        }
      }
    }

    this.bullets = this.bullets.filter(b => !toRemove.has(b.id))
    return hits
  }

  private findTankHit(bullet: Bullet, tanks: Tank[]): Tank | null {
    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (tank.id === bullet.ownerId) continue
      const dx = bullet.position.x - tank.position.x
      const dy = bullet.position.y - tank.position.y
      const hitRadius = tank.tankRadius + BULLET_HIT_BUFFER
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        return tank
      }
    }
    return null
  }

  getBullets(): Bullet[] {
    return this.bullets
  }

  removeBulletsOfOwner(ownerId: string): void {
    this.bullets = this.bullets.filter(b => b.ownerId !== ownerId)
  }

  clear(): void {
    this.bullets = []
  }
}
