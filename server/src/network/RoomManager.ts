import { type MapId, type RoomInfo, GamePhase } from '@tank-br/shared/types.js'
import { MAX_PLAYERS } from '@tank-br/shared/constants.js'
import { GameRoom, type GameRoomEvents } from '../game/GameRoom.js'
import { PlayerAccountManager } from '../game/PlayerAccountManager.js'
import type { Server } from 'socket.io'

let roomIdCounter = 0

export class RoomManager {
  private rooms = new Map<string, GameRoom>()
  private playerRooms = new Map<string, string>()
  private accountManager = new PlayerAccountManager()

  constructor(private readonly io: Server) {}

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
          const buf = room.buildBinaryState(state.tick, state.timeElapsed)
          this.io.to(roomId).emit('server:state', buf)
        } catch (e) {
          // fallback to JSON
          this.io.to(roomId).emit('server:state', state)
        }
      },
      onKill: (deadId, deadName, killerId, killerName) => {
        // keep kill as JSON for now
        this.io.to(roomId).emit('server:kill', { deadId, deadName, killerId, killerName })
      },
      onPortalExit: (playerId, playerName, stars) => {
        // Save stars to player account
        this.accountManager.addStarsFromPortal(playerId, stars)
        const account = this.accountManager.getAccount(playerId)
        const newBalance = account?.totalStars ?? 0

        this.io.to(roomId).emit('server:portal_exit', {
          playerId,
          playerName,
          stars,
          newAccountBalance: newBalance
        })
      },
      onGameOver: (leaderboard, alivePlayers) => {
        // Save stars for all alive human players
        for (const player of alivePlayers) {
          this.accountManager.addStarsFromPortal(player.id, player.stars)
        }
        this.io.to(roomId).emit('server:game_over', { leaderboard })
      }
    }

    const room = new GameRoom(roomId, mapId, events)
    this.rooms.set(roomId, room)
    return room
  }

  joinRoom(playerId: string, playerName: string, mapId: MapId, color?: string, ctfTeam?: 'a' | 'b', ctfBotsA?: number, ctfBotsB?: number): { room: GameRoom; accountStars: number; playerColor: string } | null {
    // Get or create player account
    const account = this.accountManager.getOrCreateAccount(playerId, playerName, color)

    // Check if player can afford entry
    if (!this.accountManager.canAffordEntry(playerId)) {
      return null
    }

    // Charge entry fee
    if (!this.accountManager.chargeEntry(playerId)) {
      return null
    }

    const room = this.findOrCreateRoom(mapId)
    const success = room.addPlayer(playerId, playerName, account.color, ctfTeam, ctfBotsA, ctfBotsB)
    if (!success) {
      // Refund entry fee if couldn't join room
      this.accountManager.addStarsFromPortal(playerId, 2)
      return null
    }

    this.playerRooms.set(playerId, room.roomId)
    return { room, accountStars: account.totalStars, playerColor: account.color }
  }

  leaveRoom(playerId: string): void {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return

    const room = this.rooms.get(roomId)
    if (room) {
      room.removePlayer(playerId)

      if (room.playerCount === 0) {
        room.stop()
        this.rooms.delete(roomId)
      }
    }

    this.playerRooms.delete(playerId)
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
