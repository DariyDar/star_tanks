import {
  type GameState, type MapDefinition, type PlayerInput,
  type LeaderboardEntry, type MapId, type Tank,
  GamePhase, Direction
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
import { BotController } from '../ai/BotController.js'
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
  private botController: BotController
  private indexMap: IndexMap = new IndexMap()
  private events: GameRoomEvents
  private phase: GamePhase = GamePhase.Lobby
  private startTime = 0
  private now = 0

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
    this.starManager = new StarManager(this.map.starPositions)
    this.powerUpManager = new PowerUpManager(this.map.width, this.map.height)
    this.zoneManager = new ZoneManager(this.map.width, this.map.height)
    this.portalManager = new PortalManager(this.grid, this.map.width, this.map.height)
    this.botController = new BotController(this.grid, this.map.width, this.map.height)

    this.gameLoop = new GameLoop((tick, deltaMs) => this.tick(tick, deltaMs))
  }

  addPlayer(playerId: string, name: string, color?: string): boolean {
    if (this.playerManager.totalCount >= MAX_PLAYERS) return false
    if (this.phase === GamePhase.GameOver) return false

    this.playerManager.addPlayer(playerId, name, false, color)
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
    this.playerManager.queueInput(playerId, input)
  }

  private startGame(): void {
    this.phase = GamePhase.Playing
    this.startTime = Date.now()
    this.now = this.startTime

    const mapInfo = MAP_INFO.find(m => m.id === this.mapId)
    const botCount = mapInfo?.botCount ?? 0
    for (let i = 0; i < botCount; i++) {
      this.playerManager.addPlayer(`bot_${i}`, `Bot ${i + 1}`, true)
    }

    this.gameLoop.start()
  }

  private tick(tickNum: number, _deltaMs: number): void {
    this.now = Date.now()
    const elapsed = this.now - this.startTime

    // 1. Process player inputs
    for (const tank of this.playerManager.getAllTanks()) {
      if (tank.isBot) continue
      const input = this.playerManager.consumeInput(tank.id)
      if (input) {
        this.physics.moveTank(tank, input.moveDirection, this.playerManager.getAllTanks())
        if (input.aimDirection) {
          tank.direction = input.aimDirection
        }
      }
    }

    // 1b. Bot AI movement
    const allTanks = this.playerManager.getAllTanks()
    const botMoves = this.botController.update(
      allTanks,
      this.starManager.getStars(),
      this.powerUpManager.getPowerUps(),
      this.portalManager.getPortals(),
      this.zoneManager.getZone(),
      this.now
    )
    for (const [botId, dir] of botMoves) {
      const bot = this.playerManager.getTank(botId)
      if (bot) {
        this.physics.moveTank(bot, dir, allTanks)
      }
    }

    // 2. Auto-fire for all alive tanks
    for (const tank of this.playerManager.getAliveTanks()) {
      this.bulletManager.tryFire(tank, this.now)
    }

    // 3. Update bullets and check hits
    const hits = this.bulletManager.update(this.playerManager.getAllTanks())
    for (const hit of hits) {
      if (hit.type === 'tank') {
        const killed = this.playerManager.damageTank(hit.targetId, 1)
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

          if (dead && this.phase !== GamePhase.GameOver) {
            const targetId = hit.targetId
            setTimeout(() => {
              this.playerManager.respawnTank(targetId)
            }, 3000)
          }
        }
      }
    }

    // 4. Update stars
    this.starManager.update(this.playerManager.getAliveTanks(), this.now)

    // 5. Update power-ups
    this.powerUpManager.update(this.playerManager.getAliveTanks(), this.now)
    this.playerManager.updatePowerUps(this.now)

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
    this.portalManager.update(this.now, elapsed)
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

    // 9. Update phase
    if (elapsed >= 180000 && this.phase === GamePhase.Playing) {
      this.phase = GamePhase.Shrinking
    }

    // 10. Broadcast state
    const state = this.buildGameState(tickNum, elapsed)
    this.events.onStateUpdate(state, this)
  }

  private shouldBotFire(bot: Tank, allTanks: Tank[]): boolean {
    // Bot fires if an enemy is within 10 cells and aligned with bot's direction
    const FIRE_RANGE = 10

    for (const target of allTanks) {
      if (!target.isAlive || target.id === bot.id) continue

      const dx = target.position.x - bot.position.x
      const dy = target.position.y - bot.position.y

      // Check if target is in bot's firing direction
      if (bot.direction === Direction.Up && dy < 0 && Math.abs(dx) < 1 && Math.abs(dy) <= FIRE_RANGE) {
        return true
      }
      if (bot.direction === Direction.Down && dy > 0 && Math.abs(dx) < 1 && Math.abs(dy) <= FIRE_RANGE) {
        return true
      }
      if (bot.direction === Direction.Left && dx < 0 && Math.abs(dy) < 1 && Math.abs(dx) <= FIRE_RANGE) {
        return true
      }
      if (bot.direction === Direction.Right && dx > 0 && Math.abs(dy) < 1 && Math.abs(dx) <= FIRE_RANGE) {
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
