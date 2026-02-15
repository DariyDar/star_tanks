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
  Bush = 'bush',
  Quicksand = 'quicksand'
}

export enum PowerUpType {
  RapidFire = 'rapidFire',
  Speed = 'speed',
  Shield = 'shield',
  Magnet = 'magnet',
  Heal = 'heal'
}

export enum BossAttackType {
  CircularBarrage = 'circularBarrage',    // 16 bullets in circle
  FanShot = 'fanShot',                    // 5 bullets in fan
  Spiral = 'spiral',                       // Rotating spiral pattern
  RotatingLaser = 'rotatingLaser',        // Rotating laser beam
  TripleShot = 'tripleShot',              // Rapid triple shots
  TeleportExplosion = 'teleportExplosion', // Teleport and explode
  MineField = 'mineField',                // Deploy mines
  BulletWave = 'bulletWave',              // Sequential waves
  ChaosFire = 'chaosFire',                // Random directions
  RageMode = 'rageMode'                   // Fast firing when low HP
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
  hullAngle: number      // radians, hull direction (0 = up)
  turretAngle: number    // radians, turret direction (0 = up)
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
  tankRadius: number    // Радиус танка для коллизий (растёт с количеством звёзд)
  lastDamageTime: number // Время последнего урона (для авто-регенерации)
  quicksandSlowEndTime: number // Время окончания замедления от зыбучих песков
  inBush: boolean       // Находится ли танк в кустах (для скрытности)
}

export interface Bullet {
  id: string
  ownerId: string
  position: Vec2
  angle: number          // radians, bullet travel direction
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

export interface Boss {
  id: string
  position: Vec2
  hp: number
  maxHp: number
  currentAttack: BossAttackType | null
  lastAttackTime: number
  nextAttackAt: number
  phase: number  // 0-10, represents HP thresholds (10% each)
  angle: number  // Boss facing direction
  laserAngle?: number  // For rotating laser attack
  isAlive: boolean
  lastPhaseRewardAt: number  // Track when we last gave phase rewards
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
  boss: Boss | null
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
  moveAngle: number | null   // null = standing still
  aimAngle: number            // turret direction in radians
  fire: boolean               // Whether player wants to fire this tick
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
