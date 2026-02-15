// Binary Protocol Constants

// Message type header (1 byte)
export const MSG_FULL_STATE = 0x01
export const MSG_DELTA_STATE = 0x02  // Phase 2
export const MSG_LEADERBOARD = 0x03
export const MSG_KILL = 0x04
export const MSG_PORTAL_EXIT = 0x05

// Size constants
export const TANK_DATA_SIZE = 30   // was 24: removed 1B direction, added 4B hullAngle + 4B turretAngle
export const BULLET_DATA_SIZE = 14  // was 11: removed 1B direction, added 4B angle
export const POWERUP_DATA_SIZE = 10
export const PORTAL_DATA_SIZE = 9
export const LEADERBOARD_ENTRY_SIZE = 6
export const HEADER_SIZE = 15  // type + tick + timestamp + phase + playersAlive + timeElapsed
export const ZONE_SIZE = 18

// Direction numeric mapping (Direction enum uses strings 'up','down','left','right')
export const DIR_UP = 0
export const DIR_RIGHT = 1
export const DIR_DOWN = 2
export const DIR_LEFT = 3

// Phase numeric mapping
export const PHASE_LOBBY = 0
export const PHASE_COUNTDOWN = 1
export const PHASE_PLAYING = 2
export const PHASE_SHRINKING = 3
export const PHASE_GAMEOVER = 4

// PowerUp numeric mapping
export const PU_RAPID_FIRE = 0
export const PU_SPEED = 1
export const PU_SHIELD = 2

// Helper functions for enum conversions
import { Direction, GamePhase, PowerUpType } from '../types.js'

export function directionToNumber(dir: Direction): number {
  switch (dir) {
    case Direction.Up: return DIR_UP
    case Direction.Right: return DIR_RIGHT
    case Direction.Down: return DIR_DOWN
    case Direction.Left: return DIR_LEFT
    default: return DIR_UP
  }
}

export function numberToDirection(num: number): Direction {
  switch (num) {
    case DIR_UP: return Direction.Up
    case DIR_RIGHT: return Direction.Right
    case DIR_DOWN: return Direction.Down
    case DIR_LEFT: return Direction.Left
    default: return Direction.Up
  }
}

export function phaseToNumber(phase: GamePhase): number {
  switch (phase) {
    case GamePhase.Lobby: return PHASE_LOBBY
    case GamePhase.Countdown: return PHASE_COUNTDOWN
    case GamePhase.Playing: return PHASE_PLAYING
    case GamePhase.Shrinking: return PHASE_SHRINKING
    case GamePhase.GameOver: return PHASE_GAMEOVER
    default: return PHASE_LOBBY
  }
}

export function numberToPhase(num: number): GamePhase {
  switch (num) {
    case PHASE_LOBBY: return GamePhase.Lobby
    case PHASE_COUNTDOWN: return GamePhase.Countdown
    case PHASE_PLAYING: return GamePhase.Playing
    case PHASE_SHRINKING: return GamePhase.Shrinking
    case PHASE_GAMEOVER: return GamePhase.GameOver
    default: return GamePhase.Lobby
  }
}

export function powerUpToNumber(powerUp: PowerUpType): number {
  switch (powerUp) {
    case PowerUpType.RapidFire: return PU_RAPID_FIRE
    case PowerUpType.Speed: return PU_SPEED
    case PowerUpType.Shield: return PU_SHIELD
    default: return PU_RAPID_FIRE
  }
}

export function numberToPowerUp(num: number): PowerUpType {
  switch (num) {
    case PU_RAPID_FIRE: return PowerUpType.RapidFire
    case PU_SPEED: return PowerUpType.Speed
    case PU_SHIELD: return PowerUpType.Shield
    default: return PowerUpType.RapidFire
  }
}
