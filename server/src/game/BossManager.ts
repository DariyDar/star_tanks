import type { Bullet, Tank, Vec2 } from '@tank-br/shared/types.js'
import { BossAttackType } from '@tank-br/shared/types.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'

const BOSS_ATTACK_COOLDOWN = 3000 // 3 seconds between attacks
const LASER_DAMAGE = 1
const LASER_ROTATION_SPEED = 0.05 // radians per tick

let bulletIdCounter = 0

export class BossManager {
  private currentAttack: BossAttackType | null = null
  private lastAttackTime = 0
  private nextAttackAt = 0
  private laserAngle = 0
  private rng: () => number
  private mapWidth: number
  private mapHeight: number

  constructor(mapWidth: number, mapHeight: number, _shouldSpawn: boolean) {
    this.rng = createRng(Date.now() + 12345)
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  updateAttacks(
    bossPosition: Vec2,
    now: number,
    tanks: Tank[]
  ): { newBullets: Bullet[]; damageEvents: Array<{ tankId: string; damage: number }> } {
    const newBullets: Bullet[] = []
    const damageEvents: Array<{ tankId: string; damage: number }> = []

    // Check if it's time for a new attack
    if (now >= this.nextAttackAt) {
      this.startNewAttack(now)
    }

    // Execute current attack
    if (this.currentAttack) {
      const attackResult = this.executeAttack(this.currentAttack, now, tanks, bossPosition)
      newBullets.push(...attackResult.bullets)
      damageEvents.push(...attackResult.damageEvents)
    }

    // Check for laser damage if rotating laser is active
    if (this.currentAttack === BossAttackType.RotatingLaser) {
      this.laserAngle += LASER_ROTATION_SPEED
      if (this.laserAngle > Math.PI * 2) {
        this.laserAngle -= Math.PI * 2
      }

      // Check if laser hits any tanks
      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (tank.id === 'boss_1') continue
        if (this.isLaserHittingTank(tank, bossPosition)) {
          damageEvents.push({ tankId: tank.id, damage: LASER_DAMAGE })
        }
      }
    }

    return { newBullets, damageEvents }
  }

  private startNewAttack(now: number): void {
    // Select random attack
    const attacks: BossAttackType[] = [
      BossAttackType.CircularBarrage,
      BossAttackType.FanShot,
      BossAttackType.Spiral,
      BossAttackType.RotatingLaser,
      BossAttackType.TripleShot,
      BossAttackType.TeleportExplosion,
      BossAttackType.MineField,
      BossAttackType.BulletWave,
      BossAttackType.ChaosFire,
      BossAttackType.RageMode
    ]

    const selectedAttack = attacks[rngInt(this.rng, 0, attacks.length - 1)]
    this.currentAttack = selectedAttack
    this.lastAttackTime = now

    // Attacks last different durations
    let attackDuration = BOSS_ATTACK_COOLDOWN
    if (selectedAttack === BossAttackType.RotatingLaser) {
      attackDuration = 5000 // Laser lasts 5 seconds
      this.laserAngle = 0
    } else if (selectedAttack === BossAttackType.RageMode) {
      attackDuration = 4000 // Rage lasts 4 seconds
    } else if (selectedAttack === BossAttackType.Spiral || selectedAttack === BossAttackType.BulletWave) {
      attackDuration = 3500
    }

    this.nextAttackAt = now + attackDuration
  }

  private executeAttack(
    attack: BossAttackType,
    now: number,
    tanks: Tank[],
    bossPosition: Vec2
  ): { bullets: Bullet[]; damageEvents: Array<{ tankId: string; damage: number }> } {
    const bullets: Bullet[] = []
    const damageEvents: Array<{ tankId: string; damage: number }> = []

    const timeSinceAttackStart = now - this.lastAttackTime

    switch (attack) {
      case BossAttackType.CircularBarrage:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createCircularBarrage(bossPosition))
        }
        break

      case BossAttackType.FanShot:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createFanShot(tanks, bossPosition))
        }
        break

      case BossAttackType.Spiral:
        if (timeSinceAttackStart % 200 < 50) {
          bullets.push(...this.createSpiralShot(timeSinceAttackStart, bossPosition))
        }
        break

      case BossAttackType.RotatingLaser:
        // Handled in main update loop
        break

      case BossAttackType.TripleShot:
        if (timeSinceAttackStart % 400 < 50) {
          bullets.push(...this.createTripleShot(tanks, bossPosition))
        }
        break

      case BossAttackType.TeleportExplosion:
        // Skip teleport since boss is a tank that moves
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createExplosion(bossPosition))
        }
        break

      case BossAttackType.MineField:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createMineField(bossPosition))
        }
        break

      case BossAttackType.BulletWave:
        if (timeSinceAttackStart % 500 < 50) {
          bullets.push(...this.createBulletWave(timeSinceAttackStart, bossPosition))
        }
        break

      case BossAttackType.ChaosFire:
        if (timeSinceAttackStart % 150 < 50) {
          bullets.push(...this.createChaosBullets(bossPosition))
        }
        break

      case BossAttackType.RageMode:
        if (timeSinceAttackStart % 200 < 50) {
          bullets.push(...this.createRageBullets(tanks, bossPosition))
        }
        break
    }

    return { bullets, damageEvents }
  }

  private createCircularBarrage(pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []
    const count = 16

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createFanShot(tanks: Tank[], pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    // Aim towards nearest player
    const nearestTank = this.findNearestTank(tanks, pos)
    if (!nearestTank) return bullets

    const baseAngle = Math.atan2(
      nearestTank.position.y - pos.y,
      nearestTank.position.x - pos.x
    )

    const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4] // 5 bullets in fan

    for (const spread of spreadAngles) {
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: baseAngle + spread,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createSpiralShot(timeSinceStart: number, pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    const spiralAngle = (timeSinceStart / 100) % (Math.PI * 2)
    const count = 3

    for (let i = 0; i < count; i++) {
      const angle = spiralAngle + (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createTripleShot(tanks: Tank[], pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    const nearestTank = this.findNearestTank(tanks, pos)
    if (!nearestTank) return bullets

    const angle = Math.atan2(
      nearestTank.position.y - pos.y,
      nearestTank.position.x - pos.x
    )

    for (let i = 0; i < 3; i++) {
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createExplosion(pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []
    const count = 12

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createMineField(pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    // Create 8 stationary "mine" bullets around boss
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      const distance = 5
      const x = pos.x + Math.cos(angle) * distance
      const y = pos.y + Math.sin(angle) * distance

      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x, y },
        angle: angle,
        distanceTraveled: 100 // High value so they expire quickly if not hit
      })
    }

    return bullets
  }

  private createBulletWave(timeSinceStart: number, pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    const waveNumber = Math.floor(timeSinceStart / 500)
    const baseAngle = (waveNumber * Math.PI) / 4

    for (let i = 0; i < 5; i++) {
      const angle = baseAngle + (Math.PI / 6) * (i - 2)
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createChaosBullets(pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    const count = rngInt(this.rng, 2, 5)
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createRageBullets(tanks: Tank[], pos: Vec2): Bullet[] {
    const bullets: Bullet[] = []

    // Rapid fire at all visible tanks
    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (tank.id === 'boss_1') continue

      const angle = Math.atan2(
        tank.position.y - pos.y,
        tank.position.x - pos.x
      )

      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: 'boss_1',
        position: { x: pos.x, y: pos.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private isLaserHittingTank(tank: Tank, bossPos: Vec2): boolean {
    const dx = tank.position.x - bossPos.x
    const dy = tank.position.y - bossPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 30) return false // Laser range limit

    const angleToTank = Math.atan2(dy, dx)
    let angleDiff = Math.abs(angleToTank - this.laserAngle)
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff

    return angleDiff < 0.1 // Laser width tolerance
  }

  private findNearestTank(tanks: Tank[], bossPos: Vec2): Tank | null {
    let nearest: Tank | null = null
    let nearestDistSq = Infinity

    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (tank.id === 'boss_1') continue

      const dx = tank.position.x - bossPos.x
      const dy = tank.position.y - bossPos.y
      const distSq = dx * dx + dy * dy

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        nearest = tank
      }
    }

    return nearest
  }
}
