import { type MapId, type RoomInfo, GamePhase } from '@tank-br/shared/types.js'
import { MAX_PLAYERS } from '@tank-br/shared/constants.js'
import { GameRoom, type GameRoomEvents } from '../game/GameRoom.js'
import { PlayerAccountManager } from '../game/PlayerAccountManager.js'
import type { GameDatabase } from '../db/Database.js'
import type { Server } from 'socket.io'

let roomIdCounter = 0

export class RoomManager {
  private rooms = new Map<string, GameRoom>()
  private playerRooms = new Map<string, string>()
  private accountManager: PlayerAccountManager
  // Map socket.id → stable playerId (tg_xxx, dev_xxx, or socket.id)
  private stableIds = new Map<string, string>()

  constructor(private readonly io: Server, db: GameDatabase) {
    this.accountManager = new PlayerAccountManager(db)
  }

  setStableId(socketId: string, stableId: string): void {
    this.stableIds.set(socketId, stableId)
  }

  getStableId(socketId: string): string {
    return this.stableIds.get(socketId) ?? socketId
  }

  findOrCreateRoom(mapId: MapId): GameRoom {
    for (const room of this.rooms.values()) {
      if (room.mapId === mapId && room.playerCount < MAX_PLAYERS && room.currentPhase !== GamePhase.GameOver) {
        return room
      }
    }

    const roomId = `room_${roomIdCounter++}`
    const events: GameRoomEvents = {
      onStateUpdate: (state, room) => {
        try {
          const humanIds = room.getHumanPlayerIds()
          for (const pid of humanIds) {
            const buf = room.encodeCulledState(state, pid)
            this.io.to(pid).emit('server:state', buf)
          }
        } catch (e) {
          // fallback to JSON broadcast
          this.io.to(roomId).emit('server:state', state)
        }
      },
      onKill: (deadId, deadName, killerId, killerName) => {
        // keep kill as JSON for now
        this.io.to(roomId).emit('server:kill', { deadId, deadName, killerId, killerName })
      },
      onPortalExit: (playerId, playerName, stars) => {
        // Save stars to player account using stable ID
        const stableId = this.getStableId(playerId)
        this.accountManager.addStarsFromPortal(stableId, stars)
        const account = this.accountManager.getAccount(stableId)
        const newBalance = account?.totalStars ?? 0

        this.io.to(roomId).emit('server:portal_exit', {
          playerId,
          playerName,
          stars,
          newAccountBalance: newBalance
        })
      },
      onGameOver: (leaderboard, alivePlayers) => {
        // Save stars for all alive human players using stable IDs
        for (const player of alivePlayers) {
          const stableId = this.getStableId(player.id)
          this.accountManager.addStarsFromPortal(stableId, player.stars)
        }
        this.io.to(roomId).emit('server:game_over', { leaderboard })
      }
    }

    const room = new GameRoom(roomId, mapId, events)
    this.rooms.set(roomId, room)
    return room
  }

  joinRoom(socketId: string, playerName: string, mapId: MapId, color?: string, ctfTeam?: 'a' | 'b', ctfBotsA?: number, ctfBotsB?: number): { room: GameRoom; accountStars: number; playerColor: string } | null {
    // Use stable ID for account operations
    const stableId = this.getStableId(socketId)

    // Get or create player account
    const account = this.accountManager.getOrCreateAccount(stableId, playerName, color)

    // Check if player can afford entry
    if (!this.accountManager.canAffordEntry(stableId)) {
      return null
    }

    // Charge entry fee
    if (!this.accountManager.chargeEntry(stableId)) {
      return null
    }

    const room = this.findOrCreateRoom(mapId)
    // Game room still uses socket.id as in-game player ID
    const success = room.addPlayer(socketId, playerName, account.color, ctfTeam, ctfBotsA, ctfBotsB)
    if (!success) {
      // Refund entry fee if couldn't join room
      this.accountManager.addStarsFromPortal(stableId, 10)
      return null
    }

    this.playerRooms.set(socketId, room.roomId)
    return { room, accountStars: account.totalStars, playerColor: account.color }
  }

  leaveRoom(socketId: string): void {
    const roomId = this.playerRooms.get(socketId)
    if (!roomId) return

    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(socketId)

      if (room.playerCount === 0) {
        room.stop()
        this.rooms.delete(roomId)
      }
    }

    this.playerRooms.delete(socketId)
    this.stableIds.delete(socketId)
  }

  getPlayerRoom(playerId: string): GameRoom | undefined {
    const roomId = this.playerRooms.get(playerId)
    return roomId ? this.rooms.get(roomId) : undefined
  }

  getRoomList(): RoomInfo[] {
    return Array.from(this.rooms.values()).map(room => ({
      roomId: room.roomId,
      mapId: room.mapId,
      playerCount: room.playerCount,
      botCount: room.totalCount - room.playerCount,
      maxPlayers: MAX_PLAYERS,
      phase: room.currentPhase
    }))
  }

  get roomCount(): number {
    return this.rooms.size
  }
}
