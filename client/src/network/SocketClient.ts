import { io, type Socket } from 'socket.io-client'
import type {
  ClientJoinPayload, ClientInputPayload,
  ServerJoinedPayload, ServerStatePayload,
  ServerKillPayload, ServerPortalExitPayload,
  ServerGameOverPayload, ServerPongPayload,
  ServerJoinedPayloadBinary
} from '@shared/protocol.js'
import { CLIENT_EVENTS, SERVER_EVENTS } from '@shared/protocol.js'
import { BinaryDecoder, type TankMeta } from '@shared/binary/BinaryDecoder.js'
import { SERVER_URL } from '../config.js'

export interface SocketCallbacks {
  onJoined: (payload: ServerJoinedPayload) => void
  onState: (payload: ServerStatePayload) => void
  onKill: (payload: ServerKillPayload) => void
  onPortalExit: (payload: ServerPortalExitPayload) => void
  onGameOver: (payload: ServerGameOverPayload) => void
  onError: (message: string) => void
  onDisconnect: () => void
}

export class SocketClient {
  private socket: Socket
  private latency = 0
  private decoder: BinaryDecoder | null = null

  constructor(callbacks: SocketCallbacks) {
    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false
    })

    this.socket.on(SERVER_EVENTS.JOINED, (payload: ServerJoinedPayload) => {
      // Initialize binary decoder if payload contains binary metadata
      const binaryPayload = payload as ServerJoinedPayloadBinary
      if (binaryPayload.starPositions && binaryPayload.tankMeta) {
        const tankMetaMap = new Map<number, TankMeta>()
        for (const meta of binaryPayload.tankMeta) {
          tankMetaMap.set(meta.index, {
            id: meta.id,
            name: meta.name,
            color: meta.color
          })
        }
        this.decoder = new BinaryDecoder(binaryPayload.starPositions, tankMetaMap)
      }

      callbacks.onJoined(payload)
    })

    this.socket.on(SERVER_EVENTS.STATE, (payload: ArrayBuffer | ServerStatePayload) => {
      // detect binary payload
      if (payload instanceof ArrayBuffer && this.decoder) {
        try {
          const decoded = this.decoder.decode(payload)
          if (decoded.type === 'fullState') {
            callbacks.onState(decoded.state)
            return
          }
        } catch (e) {
          // fallthrough to JSON handler
        }
      }

      callbacks.onState(payload as ServerStatePayload)
    })

    this.socket.on(SERVER_EVENTS.KILL, (payload: ServerKillPayload) => {
      callbacks.onKill(payload)
    })

    this.socket.on(SERVER_EVENTS.PORTAL_EXIT, (payload: ServerPortalExitPayload) => {
      callbacks.onPortalExit(payload)
    })

    this.socket.on(SERVER_EVENTS.GAME_OVER, (payload: ServerGameOverPayload) => {
      callbacks.onGameOver(payload)
    })

    this.socket.on(SERVER_EVENTS.ERROR, (payload: { message: string }) => {
      callbacks.onError(payload.message)
    })

    this.socket.on(SERVER_EVENTS.PONG, (payload: ServerPongPayload) => {
      this.latency = Date.now() - payload.timestamp
    })

    this.socket.on('disconnect', () => {
      callbacks.onDisconnect()
    })
  }

  connect(): void {
    this.socket.connect()
  }

  join(playerName: string, mapId: string, color?: string): void {
    const payload: ClientJoinPayload = {
      playerName,
      mapId: mapId as ClientJoinPayload['mapId'],
      color
    }
    this.socket.emit(CLIENT_EVENTS.JOIN, payload)
  }

  sendInput(input: ClientInputPayload): void {
    this.socket.emit(CLIENT_EVENTS.INPUT, input)
  }

  ping(): void {
    this.socket.emit(CLIENT_EVENTS.PING, { timestamp: Date.now() })
  }

  leave(): void {
    this.socket.emit(CLIENT_EVENTS.LEAVE, {})
  }

  disconnect(): void {
    this.socket.disconnect()
  }

  get currentLatency(): number {
    return this.latency
  }

  get id(): string {
    return this.socket.id ?? ''
  }

  get connected(): boolean {
    return this.socket.connected
  }
}
