// Map
export const MAP_WIDTH = 200
export const MAP_HEIGHT = 200
export const CELL_SIZE = 24

// Viewport
export const VIEWPORT_CELLS = 30
export const VIEWPORT_PX = VIEWPORT_CELLS * CELL_SIZE

// Tank
export const TANK_HP = 5
export const BOT_HP = 2  // Bots are easier to kill
export const TANK_SPEED = 5
export const BOT_SPEED = 3  // Bots move slower than players
export const FIRE_COOLDOWN = 1000
export const FIRE_COOLDOWN_RAPID = 500

// Collision
export const TANK_RADIUS = 0.45

// Bullet
export const BULLET_SPEED = 10
export const BULLET_RANGE = 15

// Stars
export const STARS_PER_MAP = 30
export const STAR_RESPAWN_TIME = 30000

// Power-ups
export const POWERUP_SPAWN_INTERVAL = 20000
export const POWERUP_DURATION = 10000
export const SPEED_MULTIPLIER = 1.5

// Battle Royale
export const ZONE_SHRINK_START = 180000
export const ZONE_SHRINK_PHASES = 5
export const ZONE_DAMAGE_PER_SECOND = 1
export const ZONE_PAUSE_BETWEEN = 30000

// Portals
export const PORTAL_SPAWN_INTERVAL = 60000
export const PORTAL_LIFETIME = 15000
export const PORTAL_EXIT_FADE_DURATION = 3000

// Server
export const TICK_RATE = 20
export const TICK_MS = 1000 / TICK_RATE
export const MAX_PLAYERS = 30

// Network
export const INTERPOLATION_DELAY = 20  // Reduced from 100ms to 20ms for instant response

// Brick HP - takes 3 hits to destroy for more strategic gameplay
export const BRICK_HP = 3

// Tank colors
export const TANK_COLORS = [
  '#4488FF', '#FF4444', '#44CC44', '#FFAA00',
  '#CC44CC', '#44CCCC', '#FF6644', '#88FF44',
  '#4466FF', '#FF44AA', '#AAFF44', '#44AAFF',
  '#FF8844', '#8844FF', '#44FF88', '#FFFF44',
  '#FF4488', '#88AAFF', '#CCFF44', '#44FFCC',
  '#AA44FF', '#FF6688', '#44FFAA', '#FFCC44',
  '#6644FF', '#FF4466', '#66FF44', '#44CCFF',
  '#CCAA44', '#AA44CC'
]
