import type { Boss, Bullet, Tank, Vec2, PowerUp, Star } from '@tank-br/shared/types.js'
import { BossAttackType, PowerUpType } from '@tank-br/shared/types.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'
import { BULLET_SPEED } from '@tank-br/shared/constants.js'

const BOSS_MAX_HP = 500
const BOSS_RADIUS = 1.35 // 3x normal tank (0.45 * 3)
const BOSS_ATTACK_COOLDOWN = 3000 // 3 seconds between attacks
const PHASE_REWARD_STARS = 10 // Stars dropped per phase
const LASER_DAMAGE = 1
const LASER_ROTATION_SPEED = 0.05 // radians per tick

let bulletIdCounter = 0
let powerUpIdCounter = 0
let starIdCounter = 0

export class BossManager {
  private boss: Boss | null = null
  private rng: () => number
  private mapWidth: number
  private mapHeight: number
  private droppedStars: Star[] = []
  private droppedPowerUps: PowerUp[] = []

  constructor(mapWidth: number, mapHeight: number, shouldSpawn: boolean) {
    this.rng = createRng(Date.now() + 12345)
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight

    if (shouldSpawn) {
      this.spawnBoss()
    }
  }

  private spawnBoss(): void {
    const centerX = this.mapWidth / 2
    const centerY = this.mapHeight / 2

    this.boss = {
      id: 'boss_1',
      position: { x: centerX, y: centerY },
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      currentAttack: null,
      lastAttackTime: 0,
      nextAttackAt: 0,
      phase: 10, // Start at full health (100%)
      angle: 0,
      laserAngle: 0,
      isAlive: true,
      lastPhaseRewardAt: -1
    }
  }

  update(
    now: number,
    tanks: Tank[],
    existingBullets: Bullet[]
  ): { newBullets: Bullet[]; damageEvents: Array<{ tankId: string; damage: number }> } {
    const newBullets: Bullet[] = []
    const damageEvents: Array<{ tankId: string; damage: number }> = []

    if (!this.boss || !this.boss.isAlive) {
      return { newBullets, damageEvents }
    }

    // Check if it's time for a new attack
    if (now >= this.boss.nextAttackAt) {
      this.startNewAttack(now)
    }

    // Execute current attack
    if (this.boss.currentAttack) {
      const attackResult = this.executeAttack(this.boss.currentAttack, now, tanks)
      newBullets.push(...attackResult.bullets)
      damageEvents.push(...attackResult.damageEvents)
    }

    // Check for laser damage if rotating laser is active
    if (this.boss.currentAttack === BossAttackType.RotatingLaser && this.boss.laserAngle !== undefined) {
      this.boss.laserAngle += LASER_ROTATION_SPEED
      if (this.boss.laserAngle > Math.PI * 2) {
        this.boss.laserAngle -= Math.PI * 2
      }

      // Check if laser hits any tanks
      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (this.isLaserHittingTank(tank)) {
          damageEvents.push({ tankId: tank.id, damage: LASER_DAMAGE })
        }
      }
    }

    // Rotate boss slowly
    this.boss.angle += 0.01

    return { newBullets, damageEvents }
  }

  private startNewAttack(now: number): void {
    if (!this.boss) return

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
    this.boss.currentAttack = selectedAttack
    this.boss.lastAttackTime = now

    // Attacks last different durations
    let attackDuration = BOSS_ATTACK_COOLDOWN
    if (selectedAttack === BossAttackType.RotatingLaser) {
      attackDuration = 5000 // Laser lasts 5 seconds
      this.boss.laserAngle = 0
    } else if (selectedAttack === BossAttackType.RageMode) {
      attackDuration = 4000 // Rage lasts 4 seconds
    } else if (selectedAttack === BossAttackType.Spiral || selectedAttack === BossAttackType.BulletWave) {
      attackDuration = 3500
    }

    this.boss.nextAttackAt = now + attackDuration
  }

  private executeAttack(
    attack: BossAttackType,
    now: number,
    tanks: Tank[]
  ): { bullets: Bullet[]; damageEvents: Array<{ tankId: string; damage: number }> } {
    const bullets: Bullet[] = []
    const damageEvents: Array<{ tankId: string; damage: number }> = []

    if (!this.boss) return { bullets, damageEvents }

    const timeSinceAttackStart = now - this.boss.lastAttackTime

    switch (attack) {
      case BossAttackType.CircularBarrage:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createCircularBarrage())
        }
        break

      case BossAttackType.FanShot:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createFanShot(tanks))
        }
        break

      case BossAttackType.Spiral:
        if (timeSinceAttackStart % 200 < 50) {
          bullets.push(...this.createSpiralShot(timeSinceAttackStart))
        }
        break

      case BossAttackType.RotatingLaser:
        // Handled in main update loop
        break

      case BossAttackType.TripleShot:
        if (timeSinceAttackStart % 400 < 50) {
          bullets.push(...this.createTripleShot(tanks))
        }
        break

      case BossAttackType.TeleportExplosion:
        if (timeSinceAttackStart < 100) {
          this.teleportBoss()
          bullets.push(...this.createExplosion())
        }
        break

      case BossAttackType.MineField:
        if (timeSinceAttackStart < 100) {
          bullets.push(...this.createMineField())
        }
        break

      case BossAttackType.BulletWave:
        if (timeSinceAttackStart % 500 < 50) {
          bullets.push(...this.createBulletWave(timeSinceAttackStart))
        }
        break

      case BossAttackType.ChaosFire:
        if (timeSinceAttackStart % 150 < 50) {
          bullets.push(...this.createChaosBullets())
        }
        break

      case BossAttackType.RageMode:
        if (timeSinceAttackStart % 200 < 50) {
          bullets.push(...this.createRageBullets(tanks))
        }
        break
    }

    return { bullets, damageEvents }
  }

  private createCircularBarrage(): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []
    const count = 16

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createFanShot(tanks: Tank[]): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    // Aim towards nearest player
    const nearestTank = this.findNearestTank(tanks)
    if (!nearestTank) return bullets

    const baseAngle = Math.atan2(
      nearestTank.position.y - this.boss.position.y,
      nearestTank.position.x - this.boss.position.x
    )

    const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4] // 5 bullets in fan

    for (const spread of spreadAngles) {
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: baseAngle + spread,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createSpiralShot(timeSinceStart: number): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    const spiralAngle = (timeSinceStart / 100) % (Math.PI * 2)
    const count = 3

    for (let i = 0; i < count; i++) {
      const angle = spiralAngle + (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createTripleShot(tanks: Tank[]): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    const nearestTank = this.findNearestTank(tanks)
    if (!nearestTank) return bullets

    const angle = Math.atan2(
      nearestTank.position.y - this.boss.position.y,
      nearestTank.position.x - this.boss.position.x
    )

    for (let i = 0; i < 3; i++) {
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private teleportBoss(): void {
    if (!this.boss) return

    // Teleport to random safe location
    const x = rngInt(this.rng, 50, this.mapWidth - 50)
    const y = rngInt(this.rng, 50, this.mapHeight - 50)
    this.boss.position = { x, y }
  }

  private createExplosion(): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []
    const count = 12

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createMineField(): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    // Create 8 stationary "mine" bullets around boss
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      const distance = 5
      const x = this.boss.position.x + Math.cos(angle) * distance
      const y = this.boss.position.y + Math.sin(angle) * distance

      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x, y },
        angle: angle,
        distanceTraveled: 100 // High value so they expire quickly if not hit
      })
    }

    return bullets
  }

  private createBulletWave(timeSinceStart: number): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    const waveNumber = Math.floor(timeSinceStart / 500)
    const baseAngle = (waveNumber * Math.PI) / 4

    for (let i = 0; i < 5; i++) {
      const angle = baseAngle + (Math.PI / 6) * (i - 2)
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createChaosBullets(): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    const count = rngInt(this.rng, 2, 5)
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2
      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private createRageBullets(tanks: Tank[]): Bullet[] {
    if (!this.boss) return []
    const bullets: Bullet[] = []

    // Rapid fire at all visible tanks
    for (const tank of tanks) {
      if (!tank.isAlive) continue

      const angle = Math.atan2(
        tank.position.y - this.boss.position.y,
        tank.position.x - this.boss.position.x
      )

      bullets.push({
        id: `boss_bullet_${bulletIdCounter++}`,
        ownerId: this.boss.id,
        position: { x: this.boss.position.x, y: this.boss.position.y },
        angle: angle,
        distanceTraveled: 0
      })
    }

    return bullets
  }

  private isLaserHittingTank(tank: Tank): boolean {
    if (!this.boss || this.boss.laserAngle === undefined) return false

    const dx = tank.position.x - this.boss.position.x
    const dy = tank.position.y - this.boss.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 30) return false // Laser range limit

    const angleToTank = Math.atan2(dy, dx)
    let angleDiff = Math.abs(angleToTank - this.boss.laserAngle)
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff

    return angleDiff < 0.1 // Laser width tolerance
  }

  private findNearestTank(tanks: Tank[]): Tank | null {
    if (!this.boss) return null

    let nearest: Tank | null = null
    let nearestDistSq = Infinity

    for (const tank of tanks) {
      if (!tank.isAlive) continue

      const dx = tank.position.x - this.boss.position.x
      const dy = tank.position.y - this.boss.position.y
      const distSq = dx * dx + dy * dy

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        nearest = tank
      }
    }

    return nearest
  }

  damageBoss(damage: number, now: number): boolean {
    if (!this.boss || !this.boss.isAlive) return false

    this.boss.hp -= damage
    const newPhase = Math.floor(this.boss.hp / 50)

    // Check if we crossed a phase threshold
    if (newPhase < this.boss.phase && this.boss.lastPhaseRewardAt !== newPhase) {
      this.dropPhaseRewards(now)
      this.boss.lastPhaseRewardAt = newPhase
    }

    this.boss.phase = newPhase

    if (this.boss.hp <= 0) {
      this.boss.isAlive = false
      this.dropFinalRewards(now)
      return true
    }

    return false
  }

  private dropPhaseRewards(now: number): void {
    if (!this.boss) return

    // Drop stars in circle around boss
    for (let i = 0; i < PHASE_REWARD_STARS; i++) {
      const angle = (Math.PI * 2 * i) / PHASE_REWARD_STARS
      const distance = 3 + this.rng() * 2
      const x = this.boss.position.x + Math.cos(angle) * distance
      const y = this.boss.position.y + Math.sin(angle) * distance

      this.droppedStars.push({
        id: `boss_star_${starIdCounter++}`,
        position: { x, y },
        active: true,
        respawnAt: 0
      })
    }

    // Drop 2-3 random powerups
    const powerUpCount = rngInt(this.rng, 2, 3)
    const powerUpTypes = [PowerUpType.RapidFire, PowerUpType.Shield, PowerUpType.Heal]

    for (let i = 0; i < powerUpCount; i++) {
      const angle = this.rng() * Math.PI * 2
      const distance = 2 + this.rng() * 3
      const x = this.boss.position.x + Math.cos(angle) * distance
      const y = this.boss.position.y + Math.sin(angle) * distance
      const type = powerUpTypes[rngInt(this.rng, 0, powerUpTypes.length - 1)]

      this.droppedPowerUps.push({
        id: `boss_powerup_${powerUpIdCounter++}`,
        type: type,
        position: { x, y },
        spawnedAt: now
      })
    }
  }

  private dropFinalRewards(now: number): void {
    if (!this.boss) return

    // Drop massive rewards when boss is defeated
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50
      const distance = 2 + this.rng() * 5
      const x = this.boss.position.x + Math.cos(angle) * distance
      const y = this.boss.position.y + Math.sin(angle) * distance

      this.droppedStars.push({
        id: `boss_star_final_${starIdCounter++}`,
        position: { x, y },
        active: true,
        respawnAt: 0
      })
    }

    // Drop lots of powerups
    const powerUpTypes = [PowerUpType.RapidFire, PowerUpType.Shield, PowerUpType.Heal, PowerUpType.Speed, PowerUpType.Magnet]
    for (let i = 0; i < 10; i++) {
      const angle = this.rng() * Math.PI * 2
      const distance = 2 + this.rng() * 4
      const x = this.boss.position.x + Math.cos(angle) * distance
      const y = this.boss.position.y + Math.sin(angle) * distance
      const type = powerUpTypes[rngInt(this.rng, 0, powerUpTypes.length - 1)]

      this.droppedPowerUps.push({
        id: `boss_powerup_final_${powerUpIdCounter++}`,
        type: type,
        position: { x, y },
        spawnedAt: now
      })
    }
  }

  getBoss(): Boss | null {
    return this.boss
  }

  getDroppedStars(): Star[] {
    return this.droppedStars
  }

  getDroppedPowerUps(): PowerUp[] {
    return this.droppedPowerUps
  }

  collectStar(starId: string): boolean {
    const index = this.droppedStars.findIndex(s => s.id === starId)
    if (index === -1) return false
    this.droppedStars.splice(index, 1)
    return true
  }

  collectPowerUp(powerUpId: string): boolean {
    const index = this.droppedPowerUps.findIndex(p => p.id === powerUpId)
    if (index === -1) return false
    this.droppedPowerUps.splice(index, 1)
    return true
  }

  getRadius(): number {
    return BOSS_RADIUS
  }
}
