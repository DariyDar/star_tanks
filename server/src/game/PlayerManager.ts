import {
  type Tank, type Vec2, type PlayerInput, PowerUpType
} from '@tank-br/shared/types.js'
import {
  TANK_HP, BOT_HP, TANK_SPEED, BOT_SPEED, TANK_COLORS, getTankRadius, getMaxHp
} from '@tank-br/shared/constants.js'

export class PlayerManager {
  private tanks = new Map<string, Tank>()
  private inputQueues = new Map<string, PlayerInput[]>()
  private spawnPoints: Vec2[]
  private spawnIndex = 0
  private colorIndex = 0

  constructor(spawnPoints: Vec2[]) {
    this.spawnPoints = spawnPoints
  }

  addPlayer(id: string, name: string, isBot: boolean, color?: string, isBoss: boolean = false): Tank {
    const spawn = this.spawnPoints[this.spawnIndex % this.spawnPoints.length]
    this.spawnIndex++

    // Use provided color for players, auto-assign for bots
    let tankColor: string
    if (color && !isBot) {
      tankColor = color
    } else {
      tankColor = TANK_COLORS[this.colorIndex % TANK_COLORS.length]
      this.colorIndex++
    }

    // Boss settings
    let initialMaxHp = getMaxHp(0, isBot)
    let tankRadius = getTankRadius(0)
    let speed = isBot ? BOT_SPEED : TANK_SPEED

    if (isBoss) {
      initialMaxHp = 100  // Boss has 100 HP
      tankRadius = 1.35   // Boss is 3x larger (FIXED - doesn't grow with stars)
      speed = TANK_SPEED * 1.1  // 10% faster than player
      tankColor = '#8B0000'  // Dark red for boss
    }

    const tank: Tank = {
      id,
      name,
      position: { x: spawn.x, y: spawn.y },
      hullAngle: 0,
      turretAngle: 0,
      hp: initialMaxHp,
      maxHp: initialMaxHp,
      stars: 0,
      kills: 0,
      isBot,
      isAlive: true,
      activePowerUp: null,
      powerUpEndTime: 0,
      lastFireTime: 0,
      fireCooldown: 0,
      speed: speed,
      color: tankColor,
      magnetRadius: 1,  // Базовый радиус притяжения
      tankRadius: tankRadius,  // Радиус танка
      lastDamageTime: 0,  // Время последнего урона
      quicksandSlowEndTime: 0,  // Время окончания замедления
      inBush: false  // Не в кустах при спавне
    }

    this.tanks.set(id, tank)
    this.inputQueues.set(id, [])
    return tank
  }

  removePlayer(id: string): Tank | undefined {
    const tank = this.tanks.get(id)
    this.tanks.delete(id)
    this.inputQueues.delete(id)
    return tank
  }

  getTank(id: string): Tank | undefined {
    return this.tanks.get(id)
  }

  getAllTanks(): Tank[] {
    return Array.from(this.tanks.values())
  }

  getAliveTanks(): Tank[] {
    return this.getAllTanks().filter(t => t.isAlive)
  }

  queueInput(playerId: string, input: PlayerInput): void {
    const queue = this.inputQueues.get(playerId)
    if (queue) {
      queue.push(input)
      if (queue.length > 10) queue.shift()
    }
  }

  consumeInput(playerId: string): PlayerInput | undefined {
    const queue = this.inputQueues.get(playerId)
    return queue?.shift()
  }

  peekLastInput(playerId: string): PlayerInput | undefined {
    const queue = this.inputQueues.get(playerId)
    return queue && queue.length > 0 ? queue[queue.length - 1] : undefined
  }

  clearInputQueue(playerId: string): void {
    const queue = this.inputQueues.get(playerId)
    if (queue) {
      queue.length = 0
    }
  }

  killTank(tankId: string, killerId: string | null): number {
    const tank = this.tanks.get(tankId)
    if (!tank || !tank.isAlive) return 0

    tank.isAlive = false
    const droppedStars = tank.stars
    tank.stars = 0

    if (killerId) {
      const killer = this.tanks.get(killerId)
      if (killer) {
        killer.kills++

        // Boss doesn't collect stars or grow
        if (killer.id !== 'boss_1') {
          killer.stars += droppedStars
          // Bonus: +1 star for killing a bot
          if (tank.isBot) {
            killer.stars += 1
          }
          // Update tank size and max HP based on new star count
          killer.tankRadius = getTankRadius(killer.stars)
          const newMaxHp = getMaxHp(killer.stars, killer.isBot)
          if (newMaxHp > killer.maxHp) {
            // Increase both maxHp and current hp when reaching new tier
            const hpIncrease = newMaxHp - killer.maxHp
            killer.maxHp = newMaxHp
            killer.hp = Math.min(killer.hp + hpIncrease, killer.maxHp)
          }
        }
      }
    }

    return droppedStars
  }

  respawnTank(tankId: string, isPositionSafe?: (x: number, y: number) => boolean): void {
    const tank = this.tanks.get(tankId)
    if (!tank) return

    // Find a safe spawn point
    let spawn = this.spawnPoints[this.spawnIndex % this.spawnPoints.length]

    // If zone check is provided, try to find a spawn point within safe zone
    if (isPositionSafe) {
      let foundSafe = false
      for (let i = 0; i < this.spawnPoints.length; i++) {
        const testSpawn = this.spawnPoints[(this.spawnIndex + i) % this.spawnPoints.length]
        if (isPositionSafe(testSpawn.x, testSpawn.y)) {
          spawn = testSpawn
          this.spawnIndex = (this.spawnIndex + i + 1) % this.spawnPoints.length
          foundSafe = true
          break
        }
      }
      // If no safe spawn points, tank will respawn but immediately take zone damage
      // This is expected endgame behavior when zone is very small
      if (!foundSafe) {
        this.spawnIndex++
      }
    } else {
      this.spawnIndex++
    }

    tank.position = { x: spawn.x, y: spawn.y }
    tank.hullAngle = 0
    tank.turretAngle = 0
    tank.maxHp = getMaxHp(tank.stars, tank.isBot)
    tank.hp = tank.maxHp
    tank.isAlive = true
    tank.activePowerUp = null
    tank.powerUpEndTime = 0
    tank.lastFireTime = 0
    tank.lastDamageTime = 0
    tank.quicksandSlowEndTime = 0
    tank.inBush = false
  }

  damageTank(tankId: string, damage: number, now?: number): boolean {
    const tank = this.tanks.get(tankId)
    if (!tank || !tank.isAlive) return false

    if (tank.activePowerUp === PowerUpType.Shield) return false

    tank.hp -= damage
    if (now !== undefined) {
      tank.lastDamageTime = now
    }
    return tank.hp <= 0
  }

  updatePowerUps(now: number): void {
    for (const tank of this.tanks.values()) {
      if (tank.activePowerUp && now >= tank.powerUpEndTime) {
        tank.activePowerUp = null
        tank.powerUpEndTime = 0
        // Restore original speed based on bot status
        tank.speed = tank.isBot ? BOT_SPEED : TANK_SPEED
      }
    }
  }

  updateAutoRegen(now: number): void {
    const REGEN_DELAY = 30000 // 30 seconds without damage
    for (const tank of this.tanks.values()) {
      if (!tank.isAlive) continue
      if (tank.hp >= tank.maxHp) continue

      // If 30 seconds passed since last damage, regenerate +1 HP
      if (now - tank.lastDamageTime >= REGEN_DELAY) {
        tank.hp = Math.min(tank.hp + 1, tank.maxHp)
        // Reset timer so it doesn't regen every tick
        tank.lastDamageTime = now - REGEN_DELAY + 5000 // Next regen in 5 seconds
      }
    }
  }

  get playerCount(): number {
    return Array.from(this.tanks.values()).filter(t => !t.isBot).length
  }

  get totalCount(): number {
    return this.tanks.size
  }

  get aliveCount(): number {
    return this.getAliveTanks().length
  }
}
