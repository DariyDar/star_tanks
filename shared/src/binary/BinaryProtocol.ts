// Binary protocol constants for Phase 1
export const MSG_FULL_STATE = 0x01
export const MSG_DELTA_STATE = 0x02
export const MSG_LEADERBOARD = 0x03
export const MSG_KILL = 0x04
export const MSG_PORTAL_EXIT = 0x05

export const TANK_DATA_SIZE = 24
export const BULLET_DATA_SIZE = 11
export const POWERUP_DATA_SIZE = 10
export const PORTAL_DATA_SIZE = 9
export const LEADERBOARD_ENTRY_SIZE = 6
export const HEADER_SIZE = 15
export const ZONE_SIZE = 18

export const DIR_UP = 0
export const DIR_RIGHT = 1
export const DIR_DOWN = 2
export const DIR_LEFT = 3

export const PHASE_LOBBY = 0
export const PHASE_COUNTDOWN = 1
export const PHASE_PLAYING = 2
export const PHASE_SHRINKING = 3
export const PHASE_GAMEOVER = 4

export const PU_RAPID_FIRE = 0
export const PU_SPEED = 1
export const PU_SHIELD = 2

export const MAX_PLAYERS = 30

export type Vec2 = { x: number; y: number }

export default null as any
