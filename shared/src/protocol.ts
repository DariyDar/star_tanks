import type {
  GameState, PlayerInput, RoomInfo, CompressedMapData,
  LeaderboardEntry, Portal, PowerUp, MapId
} from './types.js'

// Client -> Server
export interface ClientJoinPayload {
  playerName: string
  mapId: MapId
  color?: string  // Player's chosen tank color
}

export interface ClientInputPayload extends PlayerInput {}

export interface ClientPingPayload {
  timestamp: number
}

// Server -> Client
export interface ServerJoinedPayload {
  roomId: string
  playerId: string
  mapId: MapId
  mapData: CompressedMapData
}

// Extended join payload for binary protocol (Phase 1)
export interface ServerJoinedPayloadBinary extends ServerJoinedPayload {
  tankIndex: number
  starPositions: Array<{ x: number; y: number }>
  tankMeta: Array<{ index: number; id: string; name: string; color: string }>
  accountStars?: number  // Player's total stars in their account
}

export interface ServerStatePayload extends GameState {}

export interface ServerKillPayload {
  deadId: string
  deadName: string
  killerId: string
  killerName: string
}

export interface ServerPortalExitPayload {
  playerId: string
  playerName: string
  stars: number
  newAccountBalance?: number  // Player's new total stars after saving
}

export interface ServerGameOverPayload {
  leaderboard: LeaderboardEntry[]
}

export interface ServerPongPayload {
  timestamp: number
  serverTime: number
}

export interface ServerCountdownPayload {
  seconds: number
}

export interface ServerErrorPayload {
  message: string
}

// Event name constants
export const CLIENT_EVENTS = {
  JOIN: 'client:join',
  INPUT: 'client:input',
  PING: 'client:ping',
  LEAVE: 'client:leave'
} as const

export const SERVER_EVENTS = {
  JOINED: 'server:joined',
  STATE: 'server:state',
  KILL: 'server:kill',
  PORTAL_EXIT: 'server:portal_exit',
  GAME_OVER: 'server:game_over',
  ROOM_LIST: 'server:room_list',
  PONG: 'server:pong',
  COUNTDOWN: 'server:countdown',
  ERROR: 'server:error',
  PLAYER_JOINED: 'server:player_joined',
  PLAYER_LEFT: 'server:player_left'
} as const
