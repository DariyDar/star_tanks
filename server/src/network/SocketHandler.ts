import type { Server, Socket } from 'socket.io'
import type {
  ClientJoinPayload, ClientInputPayload, ClientPingPayload
} from '@tank-br/shared/protocol.js'
import { CLIENT_EVENTS, SERVER_EVENTS } from '@tank-br/shared/protocol.js'
import type { CompressedMapData } from '@tank-br/shared/types.js'
import { ObstacleType } from '@tank-br/shared/types.js'
import { RoomManager } from './RoomManager.js'
import { serverStats } from '../stats/ServerStats.js'

export class SocketHandler {
  private roomManager: RoomManager
  private playerNames = new Map<string, string>()

  constructor(private readonly io: Server) {
    this.roomManager = new RoomManager(io)
    this.io.on('connection', (socket) => this.handleConnection(socket))
  }

  private handleConnection(socket: Socket): void {
    socket.on(CLIENT_EVENTS.JOIN, (payload: ClientJoinPayload) => {
      this.handleJoin(socket, payload)
    })

    socket.on(CLIENT_EVENTS.INPUT, (payload: ClientInputPayload) => {
      this.handleInput(socket, payload)
    })

    socket.on(CLIENT_EVENTS.PING, (payload: ClientPingPayload) => {
      // Track ping RTT (client sends its timestamp, we measure round-trip)
      const pingMs = Date.now() - payload.timestamp
      const name = this.playerNames.get(socket.id) ?? '?'
      serverStats.recordPing(socket.id, name, pingMs)

      socket.emit(SERVER_EVENTS.PONG, {
        timestamp: payload.timestamp,
        serverTime: Date.now()
      })
    })

    socket.on(CLIENT_EVENTS.LEAVE, () => {
      this.handleLeave(socket)
    })

    socket.on('disconnect', () => {
      this.handleLeave(socket)
    })
  }

  private handleJoin(socket: Socket, payload: ClientJoinPayload): void {
    const { playerName, mapId, color, ctfTeam, ctfBotsA, ctfBotsB } = payload

    if (!playerName || !mapId) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid join payload' })
      return
    }

    this.playerNames.set(socket.id, playerName)
    const result = this.roomManager.joinRoom(socket.id, playerName, mapId, color, ctfTeam, ctfBotsA, ctfBotsB)
    if (!result) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Not enough stars to join (need 2 stars)' })
      return
    }

    const { room, accountStars, playerColor } = result
    socket.join(room.roomId)

    const mapData = compressMap(room.mapDefinition)

    // binary join payload: include assigned index, star positions and tank metadata
    const tankIndex = room.getIndexMap().getIndex(socket.id)
    const tankMeta = room.getTankMeta()

    socket.emit(SERVER_EVENTS.JOINED, {
      roomId: room.roomId,
      playerId: socket.id,
      mapId: room.mapId,
      mapData,
      tankIndex,
      starPositions: room.starPositions,
      tankMeta,
      accountStars
    })

    this.io.to(room.roomId).emit(SERVER_EVENTS.PLAYER_JOINED, {
      playerId: socket.id,
      playerName
    })
  }

  private handleInput(socket: Socket, payload: ClientInputPayload): void {
    const room = this.roomManager.getPlayerRoom(socket.id)
    if (!room) return

    room.handleInput(socket.id, payload)
  }

  private handleLeave(socket: Socket): void {
    const room = this.roomManager.getPlayerRoom(socket.id)
    if (!room) return

    this.io.to(room.roomId).emit(SERVER_EVENTS.PLAYER_LEFT, {
      playerId: socket.id
    })

    socket.leave(room.roomId)
    this.roomManager.leaveRoom(socket.id)
    this.playerNames.delete(socket.id)
    serverStats.removePlayer(socket.id)
  }
}

function compressMap(map: { width: number; height: number; obstacles: Array<{ x: number; y: number; type: ObstacleType }>; spawnPoints: Array<{ x: number; y: number }>; id: string }): CompressedMapData {
  const sorted = [...map.obstacles].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  const compressed: CompressedMapData['obstacles'] = []
  let i = 0

  while (i < sorted.length) {
    const start = sorted[i]
    let runLength = 1

    while (
      i + runLength < sorted.length &&
      sorted[i + runLength].type === start.type &&
      sorted[i + runLength].y === start.y &&
      sorted[i + runLength].x === start.x + runLength
    ) {
      runLength++
    }

    compressed.push({
      x: start.x,
      y: start.y,
      type: start.type,
      runLength
    })

    i += runLength
  }

  return {
    mapId: map.id as CompressedMapData['mapId'],
    width: map.width,
    height: map.height,
    obstacles: compressed,
    spawnPoints: map.spawnPoints
  }
}
