import {
  type Bullet, type Tank, Direction, ObstacleType, PowerUpType
} from '../../../shared/src/types.js'
import {
  directionToVec
} from '../../../shared/src/math.js'
import {
  SpatialGrid, isBlockingBullet, isDestructible
} from '../../../shared/src/collision.js'
import {
  BULLET_SPEED, BULLET_RANGE, FIRE_COOLDOWN, FIRE_COOLDOWN_RAPID,
  TICK_MS
} from '../../../shared/src/constants.js'

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

    const vec = directionToVec(tank.direction)
    const bullet: Bullet = {
      id: `b_${bulletIdCounter++}`,
      ownerId: tank.id,
      position: {
        x: tank.position.x + vec.x,
        y: tank.position.y + vec.y
      },
      direction: tank.direction,
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
      const vec = directionToVec(bullet.direction)
      const steps = Math.ceil(cellsPerTick)

      for (let step = 0; step < steps; step++) {
        bullet.position = {
          x: bullet.position.x + vec.x,
          y: bullet.position.y + vec.y
        }
        bullet.distanceTraveled += 1

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
          Math.round(bullet.position.x),
          Math.round(bullet.position.y)
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

        const hitTank = this.findTankAt(bullet, tanks)
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

  private findTankAt(bullet: Bullet, tanks: Tank[]): Tank | null {
    const bx = Math.round(bullet.position.x)
    const by = Math.round(bullet.position.y)

    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (tank.id === bullet.ownerId) continue
      if (Math.round(tank.position.x) === bx && Math.round(tank.position.y) === by) {
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
