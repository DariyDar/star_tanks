export enum Direction {
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right'
}

export enum ObstacleType {
  Brick = 'brick',
  Steel = 'steel',
  Water = 'water',
  Bush = 'bush'
}

export enum PowerUpType {
  RapidFire = 'rapidFire',
  Speed = 'speed',
  Shield = 'shield',
  Magnet = 'magnet',
  Heal = 'heal'
}

export enum GamePhase {
  Lobby = 'lobby',
  Countdown = 'countdown',
  Playing = 'playing',
  Shrinking = 'shrinking',
  GameOver = 'gameOver'
}

export interface Vec2 {
  x: number
  y: number
}

export interface Tank {
  id: string
  name: string
  position: Vec2
  direction: Direction
  hp: number
  maxHp: number
  stars: number
  kills: number
  isBot: boolean
  isAlive: boolean
  activePowerUp: PowerUpType | null
  powerUpEndTime: number
  lastFireTime: number
  fireCooldown: number
  speed: number
  color: string
  magnetRadius: number  // Радиус притяжения звёзд/бонусов (1-4)
}

export interface Bullet {
  id: string
  ownerId: string
  position: Vec2
  direction: Direction
  distanceTraveled: number
}

export interface Star {
  id: string
  position: Vec2
  active: boolean
  respawnAt: number
}

export interface PowerUp {
  id: string
  type: PowerUpType
  position: Vec2
  spawnedAt: number
}

export interface Portal {
  id: string
  position: Vec2
  spawnedAt: number
  expiresAt: number
}

export interface Zone {
  centerX: number
  centerY: number
  currentRadius: number
  targetRadius: number
  shrinkSpeed: number
  phase: number
  isShrinking: boolean
  nextShrinkAt: number
}

export interface Obstacle {
  x: number
  y: number
  type: ObstacleType
  hp: number
}

export interface MapDefinition {
  name: string
  id: MapId
  width: number
  height: number
  botCount: number
  obstacles: Obstacle[]
  spawnPoints: Vec2[]
  starPositions: Vec2[]
}

export type MapId = 'lakes' | 'megapolis' | 'village'

export interface GameState {
  tick: number
  timestamp: number
  phase: GamePhase
  tanks: Tank[]
  bullets: Bullet[]
  stars: Star[]
  powerUps: PowerUp[]
  portals: Portal[]
  zone: Zone
  leaderboard: LeaderboardEntry[]
  playersAlive: number
  timeElapsed: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  kills: number
  stars: number
  isAlive: boolean
}

export interface PlayerInput {
  tick: number
  sequenceNumber: number
  moveDirection: Direction | null
  aimDirection: Direction
  fire: boolean  // Whether player wants to fire this tick
}

export interface RoomInfo {
  roomId: string
  mapId: MapId
  playerCount: number
  botCount: number
  maxPlayers: number
  phase: GamePhase
}

export interface CompressedMapData {
  mapId: MapId
  width: number
  height: number
  obstacles: Array<{ x: number; y: number; type: ObstacleType; runLength: number }>
  spawnPoints: Vec2[]
}
