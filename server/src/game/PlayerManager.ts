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

  addPlayer(id: string, name: string, isBot: boolean, color?: string): Tank {
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

    const initialMaxHp = getMaxHp(0, isBot)
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
      speed: isBot ? BOT_SPEED : TANK_SPEED,
      color: tankColor,
      magnetRadius: 1,  // Базовый радиус притяжения
      tankRadius: getTankRadius(0)  // Базовый радиус танка
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
  }

  damageTank(tankId: string, damage: number): boolean {
    const tank = this.tanks.get(tankId)
    if (!tank || !tank.isAlive) return false

    if (tank.activePowerUp === PowerUpType.Shield) return false

    tank.hp -= damage
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
