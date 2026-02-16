import {
  type GameState, type MapDefinition, type PlayerInput,
  type LeaderboardEntry, type MapId, type Tank, type CTFState,
  GamePhase
} from '@tank-br/shared/types.js'
import { SpatialGrid } from '@tank-br/shared/collision.js'
import { getMap, MAP_INFO } from '@tank-br/shared/maps/index.js'
import { MAX_PLAYERS } from '@tank-br/shared/constants.js'
import { GameLoop } from './GameLoop.js'
import { PhysicsEngine } from './PhysicsEngine.js'
import { BulletManager } from './BulletManager.js'
import { PlayerManager } from './PlayerManager.js'
import { StarManager } from './StarManager.js'
import { PowerUpManager } from './PowerUpManager.js'
import { ZoneManager } from './ZoneManager.js'
import { PortalManager } from './PortalManager.js'
import { BossManager } from './BossManager.js'
import { BotController } from '../ai/BotController.js'
import { CTFManager } from './CTFManager.js'
import { IndexMap } from '@tank-br/shared/binary/IndexMap.js'
import { encodeFullState } from '@tank-br/shared/binary/BinaryEncoder.js'

export interface GameRoomEvents {
  onStateUpdate: (state: GameState, room: GameRoom) => void
  onKill: (deadId: string, deadName: string, killerId: string, killerName: string) => void
  onPortalExit: (playerId: string, playerName: string, stars: number) => void
  onGameOver: (leaderboard: LeaderboardEntry[]) => void
}

export class GameRoom {
  readonly roomId: string
  readonly mapId: MapId
  private map: MapDefinition
  private grid: SpatialGrid
  private gameLoop: GameLoop
  private physics: PhysicsEngine
  private bulletManager: BulletManager
  private playerManager: PlayerManager
  private starManager: StarManager
  private powerUpManager: PowerUpManager
  private zoneManager: ZoneManager
  private portalManager: PortalManager
  private bossManager: BossManager | null = null
  private ctfManager: CTFManager | null = null
  private botController: BotController
  private indexMap: IndexMap = new IndexMap()
  private events: GameRoomEvents
  private phase: GamePhase = GamePhase.Lobby
  private startTime = 0
  private now = 0
  private unstickCooldowns = new Map<string, number>()
  private botPositions = new Map<string, { x: number; y: number; since: number }>()

  constructor(roomId: string, mapId: MapId, events: GameRoomEvents) {
    this.roomId = roomId
    this.mapId = mapId
    this.events = events

    this.map = getMap(mapId)
    this.grid = new SpatialGrid(this.map.width, this.map.height)
    for (const obs of this.map.obstacles) {
      this.grid.add(obs)
    }

    this.physics = new PhysicsEngine(this.grid, this.map.width, this.map.height)
    this.bulletManager = new BulletManager(this.grid, this.map.width, this.map.height)
    this.playerManager = new PlayerManager(this.map.spawnPoints)
    this.starManager = new StarManager([]) // Stars come from bots, not map
    this.starManager.setGrid(this.grid, this.map.width, this.map.height)
    this.powerUpManager = new PowerUpManager(this.map.width, this.map.height)
    this.powerUpManager.setGrid(this.grid)
    this.zoneManager = new ZoneManager(this.map.width, this.map.height)
    this.portalManager = new PortalManager(this.grid, this.map.width, this.map.height)
    this.botController = new BotController(this.grid, this.map.width, this.map.height)

    // Boss attacks manager for Village map (boss tank is created separately)
    if (mapId === 'village') {
      this.bossManager = new BossManager(this.map.width, this.map.height, false)
    }

    // CTF manager for Capture the Flag map
    if (mapId === 'ctf' && this.map.flagPositionA && this.map.flagPositionB && this.map.baseA && this.map.baseB) {
      this.ctfManager = new CTFManager(this.map.flagPositionA, this.map.flagPositionB, this.map.baseA, this.map.baseB)
    }

    this.gameLoop = new GameLoop((tick, deltaMs) => this.tick(tick, deltaMs))
  }

  // CTF settings from the first player who joins
  private ctfSettings: { botsA: number; botsB: number } | null = null

  addPlayer(playerId: string, name: string, color?: string, ctfTeam?: 'a' | 'b', ctfBotsA?: number, ctfBotsB?: number): boolean {
    if (this.playerManager.totalCount >= MAX_PLAYERS) return false
    if (this.phase === GamePhase.GameOver) return false

    this.playerManager.addPlayer(playerId, name, false, color)

    // Assign team for CTF mode
    if (this.mapId === 'ctf') {
      const tank = this.playerManager.getTank(playerId)
      if (tank) {
        if (ctfTeam) {
          tank.team = ctfTeam
        } else {
          // Auto-balance if no team chosen
          const teamACnt = this.playerManager.getAllTanks().filter(t => t.team === 'a').length
          const teamBCnt = this.playerManager.getAllTanks().filter(t => t.team === 'b').length
          tank.team = teamACnt <= teamBCnt ? 'a' : 'b'
        }
        tank.color = tank.team === 'a' ? '#4488FF' : '#FF4444'

        // Spawn player on their team's side
        const teamSpawns = tank.team === 'a' ? this.map.spawnPointsA : this.map.spawnPointsB
        if (teamSpawns && teamSpawns.length > 0) {
          const sp = teamSpawns[Math.floor(Math.random() * teamSpawns.length)]
          tank.position = { x: sp.x, y: sp.y }
        }
      }

      // Store CTF bot settings from first player
      if (!this.ctfSettings && ctfBotsA !== undefined && ctfBotsB !== undefined) {
        this.ctfSettings = { botsA: ctfBotsA, botsB: ctfBotsB }
      }
    }

    try {
      this.indexMap.assign(playerId)
    } catch (e) {
      // ignore if no space
    }

    if (this.phase === GamePhase.Lobby) {
      this.startGame()
    }

    return true
  }

  removePlayer(playerId: string): void {
    this.bulletManager.removeBulletsOfOwner(playerId)
    this.playerManager.removePlayer(playerId)
    this.indexMap.release(playerId)

    if (this.playerManager.playerCount === 0 && this.gameLoop.isRunning) {
      this.stop()
    }
  }

  handleInput(playerId: string, input: PlayerInput): void {
    // Handle shop purchases immediately
    if (input.shopBuy) {
      this.handleShopPurchase(playerId, input.shopBuy)
    }
    // Handle unstick (spacebar teleport)
    if (input.unstick) {
      this.handleUnstick(playerId)
    }
    this.playerManager.queueInput(playerId, input)
  }

  private handleShopPurchase(playerId: string, item: number): void {
    const tank = this.playerManager.getTank(playerId)
    if (!tank || !tank.isAlive || tank.stars < 2) return

    const SHOP_COST = 2
    const now = Date.now()

    if (item === 1) {
      // Speed boost
      tank.stars -= SHOP_COST
      tank.activePowerUp = 'speed' as any
      tank.powerUpEndTime = now + 10000
      tank.speed *= 1.5
    } else if (item === 2) {
      // +2 HP
      tank.stars -= SHOP_COST
      tank.hp = Math.min(tank.hp + 2, tank.maxHp)
    } else if (item === 3) {
      // x2 Damage (rocket mode)
      tank.stars -= SHOP_COST
      tank.activePowerUp = 'rocket' as any
      tank.powerUpEndTime = now + 10000
    }
  }

  private handleUnstick(playerId: string): void {
    const tank = this.playerManager.getTank(playerId)
    if (!tank || !tank.isAlive) return

    const now = Date.now()
    const lastUnstick = this.unstickCooldowns.get(playerId) ?? 0
    if (now - lastUnstick < 10000) return // 10s cooldown

    this.unstickCooldowns.set(playerId, now)
    this.teleportNearby(tank)
  }

  private respawnWithTeam(tankId: string): void {
    this.playerManager.respawnTank(tankId, (x, y) => this.zoneManager.isPositionInSafeZone(x, y))
    // Override spawn position for CTF team members
    if (this.mapId === 'ctf') {
      const tank = this.playerManager.getTank(tankId)
      if (tank && tank.team) {
        const teamSpawns = tank.team === 'a' ? this.map.spawnPointsA : this.map.spawnPointsB
        if (teamSpawns && teamSpawns.length > 0) {
          const sp = teamSpawns[Math.floor(Math.random() * teamSpawns.length)]
          tank.position = { x: sp.x, y: sp.y }
        }
      }
    }
  }

  private teleportNearby(tank: import('@tank-br/shared/types.js').Tank): void {
    for (let attempt = 0; attempt < 50; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 3 + Math.random() * 7 // 3-10 tiles away
      const newX = Math.max(2, Math.min(this.map.width - 2, tank.position.x + Math.cos(angle) * dist))
      const newY = Math.max(2, Math.min(this.map.height - 2, tank.position.y + Math.sin(angle) * dist))

      if (this.physics.isPositionFree({ x: newX, y: newY }, tank.tankRadius)) {
        tank.position = { x: newX, y: newY }
        return
      }
    }
  }

  private startGame(): void {
    this.phase = GamePhase.Playing
    this.startTime = Date.now()
    this.now = this.startTime

    const mapInfo = MAP_INFO.find(m => m.id === this.mapId)

    // Add boss on Village map instead of regular bots
    if (this.mapId === 'village') {
      const bossId = 'boss_1'
      this.playerManager.addPlayer(bossId, 'BOSS', true, undefined, true)
      try {
        this.indexMap.assign(bossId)
      } catch (e) {
        // ignore if no space
      }
    } else if (this.mapId === 'ctf') {
      // CTF: use player-specified bot counts or defaults
      const botsA = this.ctfSettings?.botsA ?? 3
      const botsB = this.ctfSettings?.botsB ?? 3

      // Spawn Team A bots (on Team A territory)
      for (let i = 0; i < botsA; i++) {
        const botId = `bot_a_${i}`
        this.playerManager.addPlayer(botId, `Bot A${i + 1}`, true)
        const bot = this.playerManager.getTank(botId)
        if (bot) {
          bot.team = 'a'
          bot.color = '#4488FF'
          // Override spawn position to Team A territory
          if (this.map.spawnPointsA && this.map.spawnPointsA.length > 0) {
            const sp = this.map.spawnPointsA[i % this.map.spawnPointsA.length]
            bot.position = { x: sp.x, y: sp.y }
          }
        }
        try { this.indexMap.assign(botId) } catch (e) {}
      }

      // Spawn Team B bots (on Team B territory)
      for (let i = 0; i < botsB; i++) {
        const botId = `bot_b_${i}`
        this.playerManager.addPlayer(botId, `Bot B${i + 1}`, true)
        const bot = this.playerManager.getTank(botId)
        if (bot) {
          bot.team = 'b'
          bot.color = '#FF4444'
          // Override spawn position to Team B territory
          if (this.map.spawnPointsB && this.map.spawnPointsB.length > 0) {
            const sp = this.map.spawnPointsB[i % this.map.spawnPointsB.length]
            bot.position = { x: sp.x, y: sp.y }
          }
        }
        try { this.indexMap.assign(botId) } catch (e) {}
      }
    } else {
      // Add regular bots on other maps
      const botCount = mapInfo?.botCount ?? 0
      for (let i = 0; i < botCount; i++) {
        const botId = `bot_${i}`
        this.playerManager.addPlayer(botId, `Bot ${i + 1}`, true)
        try { this.indexMap.assign(botId) } catch (e) {}
      }
    }

    this.gameLoop.start()
  }

  private tick(tickNum: number, _deltaMs: number): void {
    this.now = Date.now()
    const elapsed = this.now - this.startTime

    // 1. Process player inputs (use latest input only to prevent lag)
    for (const tank of this.playerManager.getAllTanks()) {
      if (tank.isBot) continue
      const input = this.playerManager.peekLastInput(tank.id)
      if (input) {
        // Clear queue to prevent input accumulation
        this.playerManager.clearInputQueue(tank.id)

        this.physics.moveTank(tank, input.moveAngle, this.playerManager.getAllTanks(), this.now)
        tank.turretAngle = input.aimAngle
        // Fire if player requested
        if (input.fire) {
          this.bulletManager.tryFire(tank, this.now)
        }
      }
    }

    // 1b. Bot AI movement
    const allTanks = this.playerManager.getAllTanks()
    // Prepare CTF info for bots if in CTF mode
    const ctfInfo = this.ctfManager ? (() => {
      const s = this.ctfManager!.getState()
      return { flagA: s.flagA, flagB: s.flagB, flagACarrier: s.flagACarrier, flagBCarrier: s.flagBCarrier, baseA: s.baseA, baseB: s.baseB }
    })() : undefined

    const botMoves = this.botController.update(
      allTanks,
      this.starManager.getStars(),
      this.powerUpManager.getPowerUps(),
      this.portalManager.getPortals(),
      this.zoneManager.getZone(),
      this.now,
      ctfInfo
    )
    for (const [botId, move] of botMoves) {
      const bot = this.playerManager.getTank(botId)
      if (bot) {
        this.physics.moveTank(bot, move.moveAngle, allTanks, this.now)
        bot.turretAngle = move.aimAngle
      }
    }

    // 1c. Bot anti-stuck: teleport bots that haven't moved
    for (const tank of allTanks) {
      if (!tank.isBot || !tank.isAlive) continue
      const prev = this.botPositions.get(tank.id)
      if (prev) {
        const dx = tank.position.x - prev.x
        const dy = tank.position.y - prev.y
        if (dx * dx + dy * dy < 0.1) {
          if (this.now - prev.since > 2000) {
            this.teleportNearby(tank)
            this.botPositions.set(tank.id, { x: tank.position.x, y: tank.position.y, since: this.now })
          }
        } else {
          this.botPositions.set(tank.id, { x: tank.position.x, y: tank.position.y, since: this.now })
        }
      } else {
        this.botPositions.set(tank.id, { x: tank.position.x, y: tank.position.y, since: this.now })
      }
    }

    // 2. Bot firing (fire when turret is aimed at a target)
    for (const tank of this.playerManager.getAliveTanks()) {
      if (!tank.isBot) continue
      // Boss fires through special attacks, not regular firing
      if (tank.id === 'boss_1') continue
      if (this.shouldBotFire(tank, allTanks)) {
        this.bulletManager.tryFire(tank, this.now)
      }
    }

    // 2b. Boss special attacks (if boss tank exists)
    if (this.bossManager) {
      const bossTank = this.playerManager.getTank('boss_1')
      if (bossTank && bossTank.isAlive) {
        const bossResult = this.bossManager.updateAttacks(
          bossTank.position,
          this.now,
          allTanks,
          bossTank.hp
        )

        // Add boss attack bullets to bullet manager
        for (const bullet of bossResult.newBullets) {
          this.bulletManager.addBullet(bullet)
        }

        // Drop stars if boss passed HP threshold
        if (bossResult.droppedStars > 0) {
          this.starManager.dropStarsAtPosition(bossTank.position, bossResult.droppedStars)
        }

        // Add dropped powerups to powerup manager
        for (const powerUp of bossResult.droppedPowerUps) {
          this.powerUpManager.addPowerUp(powerUp)
        }

        // Apply boss laser/attack damage to tanks
        for (const damageEvent of bossResult.damageEvents) {
          const killed = this.playerManager.damageTank(damageEvent.tankId, damageEvent.damage, this.now)
          if (killed) {
            const dead = this.playerManager.getTank(damageEvent.tankId)
            const droppedStars = this.playerManager.killTank(damageEvent.tankId, 'boss_1')

            if (dead && bossTank) {
              this.events.onKill(dead.id, dead.name, bossTank.id, bossTank.name)
            }

            if (dead && droppedStars > 0) {
              this.starManager.dropStarsAtPosition(dead.position, droppedStars)
            }

            if (dead && this.phase !== GamePhase.GameOver) {
              const targetId = damageEvent.tankId
              setTimeout(() => {
                this.respawnWithTeam(targetId)
              }, 3000)
            }
          }
        }
      }
    }

    // 3. Update bullets and check hits
    const hits = this.bulletManager.update(this.playerManager.getAllTanks())

    for (const hit of hits) {
      if (hit.type === 'tank') {
        const damage = hit.bullet.isRocket ? 2 : 1
        const killed = this.playerManager.damageTank(hit.targetId, damage, this.now)
        if (killed) {
          const dead = this.playerManager.getTank(hit.targetId)
          const killer = this.playerManager.getTank(hit.bullet.ownerId)
          const droppedStars = this.playerManager.killTank(hit.targetId, hit.bullet.ownerId)

          if (dead && killer) {
            this.events.onKill(dead.id, dead.name, killer.id, killer.name)
          }

          if (dead && droppedStars > 0) {
            this.starManager.dropStarsAtPosition(dead.position, droppedStars)
          }

          // Boss drops 30 bonus stars on death
          if (dead && hit.targetId === 'boss_1') {
            this.starManager.dropStarsAtPosition(dead.position, 30)
          }

          // CTF: drop flag if carrier is killed
          if (dead && this.ctfManager) {
            this.ctfManager.onTankKilled(hit.targetId, dead.position)
          }

          if (dead && this.phase !== GamePhase.GameOver) {
            const targetId = hit.targetId
            // Boss does not respawn
            if (targetId !== 'boss_1') {
              setTimeout(() => {
                this.respawnWithTeam(targetId)
              }, 3000)
            }
          }
        }
      }
    }

    // 3b. CTF flag logic
    if (this.ctfManager) {
      this.ctfManager.update(this.playerManager.getAliveTanks())
    }

    // 4. Update stars
    this.starManager.update(this.playerManager.getAliveTanks(), this.now)

    // 5. Update power-ups
    this.powerUpManager.update(
      this.playerManager.getAliveTanks(),
      this.now,
      (x, y) => this.zoneManager.isPositionInSafeZone(x, y)
    )
    this.playerManager.updatePowerUps(this.now)
    this.playerManager.updateAutoRegen(this.now)

    // 6. Zone shrinking + damage
    this.zoneManager.update(this.playerManager.getAliveTanks(), elapsed, this.now)

    // Check zone kill
    for (const tank of this.playerManager.getAliveTanks()) {
      if (tank.hp <= 0) {
        this.playerManager.killTank(tank.id, null)
        this.events.onKill(tank.id, tank.name, '', 'Zone')
      }
    }

    // 7. Portals
    this.portalManager.update(
      this.now,
      elapsed,
      (x, y) => this.zoneManager.isPositionInSafeZone(x, y)
    )
    const portalEntries = this.portalManager.checkPortalEntry(this.playerManager.getAliveTanks())
    for (const { tank } of portalEntries) {
      this.events.onPortalExit(tank.id, tank.name, tank.stars)
      tank.isAlive = false
    }

    // 8. Check game over
    if (this.zoneManager.isFullyShrunk() || this.playerManager.aliveCount === 0) {
      this.stop()
      return
    }

    // 8b. CTF time limit: 4 minutes
    if (this.mapId === 'ctf' && elapsed >= 240000) {
      this.stop()
      return
    }

    // 9. Update phase
    if (elapsed >= 180000 && this.phase === GamePhase.Playing) {
      this.phase = GamePhase.Shrinking
    }

    // 10. Broadcast state
    const state = this.buildGameState(tickNum, elapsed)
    this.events.onStateUpdate(state, this)
  }

  private shouldBotFire(bot: Tank, allTanks: Tank[]): boolean {
    const FIRE_RANGE_SQ = 10 * 10

    for (const target of allTanks) {
      if (!target.isAlive || target.id === bot.id) continue
      // In CTF: bots fight enemy team (bots AND players)
      if (bot.team && target.team) {
        if (target.team === bot.team) continue // don't shoot teammates
        // Allow shooting enemy team bots
      } else {
        // Non-CTF: bots don't shoot each other
        if (target.isBot && bot.isBot) continue
      }

      const dx = target.position.x - bot.position.x
      const dy = target.position.y - bot.position.y
      const distSq = dx * dx + dy * dy

      if (distSq > FIRE_RANGE_SQ) continue

      // Check if turret is roughly aimed at target (within ~17 degrees)
      const angleToTarget = Math.atan2(dx, -dy)
      let angleDiff = angleToTarget - bot.turretAngle
      angleDiff = angleDiff - Math.round(angleDiff / (2 * Math.PI)) * 2 * Math.PI
      if (Math.abs(angleDiff) < 0.3) {
        return true
      }
    }

    return false
  }

  private buildGameState(tick: number, timeElapsed: number): GameState {
    const tanks = this.playerManager.getAllTanks()
    const leaderboard: LeaderboardEntry[] = tanks
      .map(t => ({
        id: t.id,
        name: t.name,
        kills: t.kills,
        stars: t.stars,
        isAlive: t.isAlive
      }))
      .sort((a, b) => b.stars - a.stars || b.kills - a.kills)

    return {
      tick,
      timestamp: this.now,
      phase: this.phase,
      tanks,
      bullets: this.bulletManager.getBullets(),
      stars: this.starManager.getStars(),
      powerUps: this.powerUpManager.getPowerUps(),
      portals: this.portalManager.getPortals(),
      zone: this.zoneManager.getZone(),
      boss: null,  // Boss is now a regular tank, not a separate entity
      ctf: this.ctfManager ? this.ctfManager.getState() : null,
      ctfTimeRemaining: this.mapId === 'ctf' ? Math.max(0, Math.ceil((240000 - timeElapsed) / 1000)) : 0,
      leaderboard,
      playersAlive: this.playerManager.aliveCount,
      timeElapsed
    }
  }

  buildBinaryState(tick: number, timeElapsed: number): ArrayBuffer {
    const state = this.buildGameState(tick, timeElapsed)
    return encodeFullState(state, this.indexMap as any)
  }

  getIndexMap(): IndexMap {
    return this.indexMap
  }

  get starPositions() {
    return this.map.starPositions
  }

  getTankMeta(): Array<{ index: number; id: string; name: string; color: string }> {
    const all = this.indexMap.getAll()
    return all.map(({ id, index }) => {
      const t = this.playerManager.getTank(id)
      return { index, id, name: t?.name ?? id, color: t?.color ?? '#ffffff' }
    })
  }

  stop(): void {
    this.gameLoop.stop()
    this.phase = GamePhase.GameOver

    const state = this.buildGameState(this.gameLoop.currentTick, this.now - this.startTime)
    this.events.onGameOver(state.leaderboard)
  }

  get playerCount(): number {
    return this.playerManager.playerCount
  }

  get totalCount(): number {
    return this.playerManager.totalCount
  }

  get currentPhase(): GamePhase {
    return this.phase
  }

  get mapDefinition(): MapDefinition {
    return this.map
  }

  get isRunning(): boolean {
    return this.gameLoop.isRunning
  }
}
