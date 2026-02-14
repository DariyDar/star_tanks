import {
  type Tank, type Vec2, type PlayerInput, Direction, PowerUpType
} from '../../../shared/src/types.js'
import {
  TANK_HP, TANK_SPEED, TANK_COLORS
} from '../../../shared/src/constants.js'

export class PlayerManager {
  private tanks = new Map<string, Tank>()
  private inputQueues = new Map<string, PlayerInput[]>()
  private spawnPoints: Vec2[]
  private spawnIndex = 0
  private colorIndex = 0

  constructor(spawnPoints: Vec2[]) {
    this.spawnPoints = spawnPoints
  }

  addPlayer(id: string, name: string, isBot: boolean): Tank {
    const spawn = this.spawnPoints[this.spawnIndex % this.spawnPoints.length]
    this.spawnIndex++

    const tank: Tank = {
      id,
      name,
      position: { x: spawn.x, y: spawn.y },
      direction: Direction.Up,
      hp: TANK_HP,
      maxHp: TANK_HP,
      stars: 0,
      kills: 0,
      isBot,
      isAlive: true,
      activePowerUp: null,
      powerUpEndTime: 0,
      lastFireTime: 0,
      fireCooldown: 0,
      speed: TANK_SPEED,
      color: TANK_COLORS[this.colorIndex % TANK_COLORS.length]
    }
    this.colorIndex++

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
      }
    }

    return droppedStars
  }

  respawnTank(tankId: string): void {
    const tank = this.tanks.get(tankId)
    if (!tank) return

    const spawn = this.spawnPoints[this.spawnIndex % this.spawnPoints.length]
    this.spawnIndex++

    tank.position = { x: spawn.x, y: spawn.y }
    tank.direction = Direction.Up
    tank.hp = TANK_HP
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
        tank.speed = TANK_SPEED
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
