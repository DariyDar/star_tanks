# Performance & Visual Upgrade — Implementation Plan

## Quick Start

```bash
git clone https://github.com/DariyDar/star_tanks.git
cd star_tanks
npm install
```

Verify the project builds:
```bash
npm run build --workspace=shared
npm run build --workspace=server
npm run build --workspace=client
```

Test server starts:
```bash
node server/dist/index.js
# Expected: "Tank Battle Royale server running on port 3001"
```

---

## Project Structure

```
tank-battle-royale/
├── shared/src/         # Shared types, constants, math, collision, maps
├── server/src/         # Express + Socket.IO, 20Hz game loop
│   ├── game/           # GameRoom, PhysicsEngine, BulletManager, etc.
│   ├── network/        # SocketHandler, RoomManager
│   └── ai/             # BotController, Pathfinding
└── client/src/         # Vite + Canvas 2D
    ├── game/           # GameClient, Camera, InputManager
    ├── rendering/      # Renderer, MapRenderer, TankRenderer, etc.
    ├── network/        # SocketClient, StateBuffer
    └── ui/             # LobbyScreen, ResultScreen, MobileControls
```

Tech: npm workspaces monorepo, TypeScript, Socket.IO, Canvas 2D, Vite.
Deployed: GitHub Pages (client), Render.com Docker (server).

---

## What To Implement (3 Phases)

### Phase 1: Binary Protocol (MUST be done first)
### Phase 2: Delta Compression + Area of Interest (depends on Phase 1)
### Phase 3: Visual Improvements (independent, can be done in parallel)

---

## Phase 1: Binary Protocol

**Goal:** Replace JSON serialization with ArrayBuffer. Socket.IO stays (it supports binary natively).

### Current Problem
- `server/src/network/RoomManager.ts:24` — `io.to(roomId).emit('server:state', state)` sends full JSON GameState
- Each state is ~3-5 KB JSON × 30 clients × 20 ticks/s = ~3-4 MB/s

### Key Design Decision: ID Mapping
Tank IDs are currently strings (`socket.id`, `bot_0`..`bot_N`). Binary uses `uint8` indices (0-29).
Server assigns index at join time. Client receives mapping in `server:joined` payload.

### Binary Message Format

**Message type header (1 byte):**
- `0x01` = FULL_STATE (every tick)
- `0x03` = LEADERBOARD (every 5th tick)
- `0x04` = KILL_EVENT
- `0x05` = PORTAL_EXIT_EVENT

**FULL_STATE (0x01):**
```
Offset  Size    Type      Field
0       1       uint8     messageType = 0x01
1       4       uint32    tick
5       4       float32   timestamp (seconds since game start)
9       1       uint8     phase (0=Lobby,1=Countdown,2=Playing,3=Shrinking,4=GameOver)
10      1       uint8     playersAlive
11      4       float32   timeElapsed (seconds)

--- Zone (18 bytes) ---
15      2       uint16    centerX
17      2       uint16    centerY
19      4       float32   currentRadius
23      4       float32   targetRadius
27      1       uint8     isShrinking (0/1)
28      1       uint8     zonePhase
29      4       float32   nextShrinkAt

--- Tanks ---
33      1       uint8     tankCount (N)
34      N*24    TankData[N]

--- Bullets ---
?       1       uint8     bulletCount (M)
?       M*11    BulletData[M]

--- Stars ---
?       4       uint32    starActiveBits (bitfield, 30 stars max)

--- PowerUps ---
?       1       uint8     powerUpCount (P)
?       P*10    PowerUpData[P]

--- Portals ---
?       1       uint8     portalCount (Q)
?       Q*9     PortalData[Q]
```

**TankData (24 bytes):**
```
Offset  Size    Type      Field
0       1       uint8     index (0-29)
1       4       float32   positionX
5       4       float32   positionY
9       1       uint8     direction (0=Up,1=Right,2=Down,3=Left)
10      1       uint8     hp
11      1       uint8     maxHp
12      2       uint16    stars
14      2       uint16    kills
16      1       uint8     flags (bit0=isBot, bit1=isAlive, bit2=hasShield, bit3=hasRapidFire, bit4=hasSpeed)
17      1       uint8     colorIndex (index into TANK_COLORS array in constants.ts)
18      4       float32   powerUpEndTime (0 if none)
22      2       uint16    fireCooldown (ms)
```

**BulletData (11 bytes):**
```
0       1       uint8     ownerIndex
1       4       float32   positionX
5       4       float32   positionY
9       1       uint8     direction (0-3)
10      1       uint8     distanceTraveled (integer)
```

**PowerUpData (10 bytes):**
```
0       1       uint8     type (0=RapidFire, 1=Speed, 2=Shield)
1       4       float32   positionX
5       4       float32   positionY
9       1       uint8     id
```

**PortalData (9 bytes):**
```
0       4       float32   positionX
4       4       float32   positionY
8       1       uint8     id
```

**LEADERBOARD (0x03) — sent every 5th tick:**
```
0       1       uint8     messageType = 0x03
1       1       uint8     entryCount (N)
2       N*6     entries
  Entry (6 bytes):
    0   1       uint8     tankIndex
    1   2       uint16    stars
    3   2       uint16    kills
    5   1       uint8     flags (bit0=isAlive)
```

**KILL_EVENT (0x04):**
```
0       1       uint8     messageType = 0x04
1       1       uint8     deadIndex
2       1       uint8     killerIndex (0xFF = zone kill)
```

**PORTAL_EXIT_EVENT (0x05):**
```
0       1       uint8     messageType = 0x05
1       1       uint8     playerIndex
2       2       uint16    stars
```

### Files to CREATE

**`shared/src/binary/BinaryProtocol.ts`** (~60 lines)
```typescript
// Message type constants
export const MSG_FULL_STATE = 0x01
export const MSG_DELTA_STATE = 0x02  // Phase 2
export const MSG_LEADERBOARD = 0x03
export const MSG_KILL = 0x04
export const MSG_PORTAL_EXIT = 0x05

// Size constants
export const TANK_DATA_SIZE = 24
export const BULLET_DATA_SIZE = 11
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
```

**`shared/src/binary/IndexMap.ts`** (~50 lines)
- Manages bidirectional mapping: string tank ID ↔ uint8 index
- `assign(id: string): number` — assigns next free index
- `release(id: string): void` — frees index
- `getIndex(id: string): number` — returns index
- `getId(index: number): string` — returns ID
- `getAll(): Array<{id: string, index: number}>`

**`shared/src/binary/BinaryEncoder.ts`** (~220 lines)
- `encodeFullState(state: GameState, indexMap: IndexMap): ArrayBuffer`
- `encodeLeaderboard(leaderboard: LeaderboardEntry[], indexMap: IndexMap): ArrayBuffer`
- `encodeKillEvent(deadIndex: number, killerIndex: number): ArrayBuffer`
- `encodePortalExitEvent(playerIndex: number, stars: number): ArrayBuffer`
- Uses DataView for writing: `view.setUint8()`, `view.setFloat32()`, `view.setUint16()`
- Star active bits: loop through stars, set bits in uint32

**`shared/src/binary/BinaryDecoder.ts`** (~220 lines)
- `decode(buffer: ArrayBuffer): DecodedMessage` — reads first byte, dispatches
- `decodeFullState(): GameState` — reads all fields in order, reconstructs objects
- Needs: `starPositions: Vec2[]` (from join payload) to reconstruct Star objects
- Needs: `tankMeta: Map<number, {id: string, name: string, color: string}>` (from join payload)
- Direction/Phase/PowerUpType numeric → enum conversion

### Files to MODIFY

**`shared/src/protocol.ts`**
- Add to `ServerJoinedPayload`:
  ```typescript
  tankIndex: number           // this player's binary index
  starPositions: Vec2[]       // fixed star positions for decoding
  tankMeta: Array<{           // initial tank metadata
    index: number
    id: string
    name: string
    color: string
  }>
  ```

**`server/src/game/GameRoom.ts`**
- Add `private indexMap = new IndexMap()` field
- In `addPlayer()`: call `indexMap.assign(playerId)`
- In `removePlayer()`: call `indexMap.release(playerId)`
- Add method `buildBinaryState(tick, timeElapsed): ArrayBuffer`
  - Uses `BinaryEncoder.encodeFullState(this.buildGameState(tick, elapsed), this.indexMap)`
- In tick (line 212): call `buildBinaryState()` instead of `buildGameState()` for broadcast
- Expose `indexMap` getter for SocketHandler
- Expose `starPositions` for join payload

**`server/src/network/RoomManager.ts`**
- Line 24: change `this.io.to(roomId).emit('server:state', state)` to emit binary buffer
- Lines 27, 30, 33: encode kill/portal/gameover events as binary too
- Need reference to room's IndexMap for encoding

**`server/src/network/SocketHandler.ts`**
- In `handleJoin()` (line 61): add `tankIndex`, `starPositions`, `tankMeta` to joined payload
- When new player joins, broadcast updated tankMeta to all players in room

**`client/src/network/SocketClient.ts`**
- In state listener (line 35): detect if payload is ArrayBuffer → decode with BinaryDecoder
- Store `BinaryDecoder` instance with star positions and tank metadata from join

**`client/src/game/GameClient.ts`**
- Store `tankMeta: Map<number, {id, name, color}>` from join payload
- Store `starPositions: Vec2[]` from join payload
- Pass to BinaryDecoder for reconstruction

### Step-by-step Implementation Order

1. Create `shared/src/binary/BinaryProtocol.ts`
2. Create `shared/src/binary/IndexMap.ts`
3. Create `shared/src/binary/BinaryEncoder.ts`
4. Create `shared/src/binary/BinaryDecoder.ts`
5. Modify `shared/src/protocol.ts` — extend ServerJoinedPayload
6. Modify `server/src/game/GameRoom.ts` — IndexMap + buildBinaryState
7. Modify `server/src/network/RoomManager.ts` — binary emit
8. Modify `server/src/network/SocketHandler.ts` — send metadata at join
9. Modify `client/src/network/SocketClient.ts` — binary detection + decode
10. Modify `client/src/game/GameClient.ts` — store metadata
11. Build all, test

### Verification
- Encode GameState → ArrayBuffer → decode → deep compare with original
- Log `buffer.byteLength` and compare with `JSON.stringify(state).length`
- Play the game — should work identically
- Target: encode/decode < 1ms per tick

---

## Phase 2: Delta Compression + Area of Interest

**DEPENDS ON PHASE 1.** Do not start until Phase 1 is working.

**Goal:** Instead of sending full state every tick, send only changes in player's viewport.

### Design

**Server-side:** Track `lastSentState` per player. Each tick, compute delta:
- Only include tanks/bullets in player's viewport (30 cells + 10 buffer = 40×40 area)
- For tanks: only send changed fields (position, hp, stars, direction, flags, powerup)
- For bullets: only send NEW bullets and REMOVED bullet IDs (client predicts movement)
- Stars: always send 4-byte bitfield (cheap enough)
- Leaderboard: every 5th tick
- Zone: always send (only 18 bytes)

**Client-side:** Maintain full state cache. Apply deltas on top. Predict bullet positions.

### Delta Message Format (0x02)
```
Offset  Size    Type      Field
0       1       uint8     messageType = 0x02
1       4       uint32    tick
5       4       float32   timestamp
9       1       uint8     changeFlags (bitmask)
10      1       uint8     phase
11      1       uint8     playersAlive
12      4       float32   timeElapsed

changeFlags bits:
  bit0 = hasTankChanges
  bit1 = hasNewBullets
  bit2 = hasRemovedBullets
  bit3 = hasZone
  bit4 = hasStars
  bit5 = hasPowerUps
  bit6 = hasPortals
  bit7 = hasLeaderboard
```

**Tank delta:**
```
1B tankIndex
1B fieldFlags (which fields changed)
  bit0 = position (8B: 2×float32)
  bit1 = direction (1B)
  bit2 = hp (1B)
  bit3 = stars (2B)
  bit4 = kills (2B)
  bit5 = flags (1B)
  bit6 = powerUp (5B: type + endTime)
Only changed fields are written after fieldFlags.
```

**Typical delta: ~50-150 bytes** vs 1,400 bytes full binary.

### Files to CREATE

**`server/src/network/DeltaTracker.ts`** (~200 lines)
- Per-player state: `Map<string, PlayerTrackingData>`
  - `lastSentTanks: Map<number, TankSnapshot>` — last sent tank states by index
  - `lastSentBulletIds: Set<number>` — bullet IDs sent last tick
  - `lastStarBits: number` — last sent star bitfield
  - `leaderboardTick: number` — last tick leaderboard was sent
- `computeDelta(playerId, playerPosition, currentState, indexMap): ArrayBuffer | null`
  - Filter entities by AoI (player viewport + 10 cell buffer)
  - Compare tanks with lastSent → only changed fields
  - New bullets = current - lastSent, removed = lastSent - current
  - Returns null if nothing changed (extremely rare)
- `resetPlayer(playerId)` — force full state on next tick
- `removePlayer(playerId)` — cleanup

**`server/src/network/AoIFilter.ts`** (~60 lines)
- `filterByViewport<T extends {position: Vec2}>(entities: T[], centerX, centerY, halfSize): T[]`
- `isInAoI(x, y, centerX, centerY, halfSize): boolean`
- halfSize = 20 (viewport 30 + buffer 10)

**`shared/src/binary/DeltaEncoder.ts`** (~200 lines)
- `encodeDelta(delta: DeltaData, indexMap: IndexMap): ArrayBuffer`
- Pre-calculates size, allocates ArrayBuffer, writes fields

**`shared/src/binary/DeltaDecoder.ts`** (~180 lines)
- `decodeDelta(buffer: ArrayBuffer): DeltaData`
- Returns structured delta for ClientStateCache to apply

**`client/src/network/ClientStateCache.ts`** (~120 lines)
- `applyFullState(state: GameState): GameState`
- `applyDelta(delta: DeltaData): GameState`
  - Merge changed tanks into cached state
  - Add new bullets, remove deleted ones
  - Predict existing bullet positions: `pos += dir * BULLET_SPEED * TICK_MS/1000`
  - Update stars from bitfield
  - Merge zone/powerups/portals/leaderboard if present

### Files to MODIFY

**`shared/src/binary/BinaryProtocol.ts`**
- Add `MSG_DELTA_STATE = 0x02`
- Add field flag constants

**`server/src/network/RoomManager.ts`**
- Replace `io.to(roomId).emit()` with per-socket loop
- For each socket: compute delta via DeltaTracker, emit to individual socket
- On first state after join: send full state (DeltaTracker.resetPlayer)

**`server/src/game/GameRoom.ts`**
- Export player positions for AoI filtering
- Separate leaderboard computation (don't compute every tick if not sending)

**`client/src/network/SocketClient.ts`**
- Route message types: FULL_STATE → ClientStateCache.applyFullState, DELTA → applyDelta
- Both produce a full GameState for StateBuffer

**`client/src/network/StateBuffer.ts`**
- No structural change — accepts reconstructed GameState from ClientStateCache

### Verification
- Run full-state and delta paths in parallel for 1000 ticks, compare
- Average delta < 200 bytes during normal play
- Edge cases: join mid-game, respawn, tank enters/leaves AoI
- Bullet prediction is visually smooth

---

## Phase 3: Visual Improvements

**INDEPENDENT of Phases 1-2. Can be done in parallel.**

**Goal:** DPI-sharp rendering, glow effects, particles, modern look.

### 3.1 DPI Scaling (fixes blurriness)

**File:** `client/src/rendering/Renderer.ts`

Current `resize()` (line 31-36):
```typescript
private resize(): void {
  const size = Math.min(window.innerWidth, window.innerHeight)
  this.canvas.width = size
  this.canvas.height = size
  this.cellPx = size / VIEWPORT_CELLS
}
```

Change to:
```typescript
private resize(): void {
  const dpr = window.devicePixelRatio || 1
  const size = Math.min(window.innerWidth, window.innerHeight)
  this.canvas.width = size * dpr
  this.canvas.height = size * dpr
  this.canvas.style.width = `${size}px`
  this.canvas.style.height = `${size}px`
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  this.cellPx = size / VIEWPORT_CELLS
}
```

Also remove `image-rendering: pixelated` from CSS if present in `client/index.html`.
All sub-renderers use logical pixel coordinates — DPR transform handles scaling.

### 3.2 Particle System

**New file:** `client/src/rendering/ParticleSystem.ts` (~150 lines)

```typescript
interface Particle {
  x: number; y: number          // world coordinates
  vx: number; vy: number        // world units per second
  life: number                  // 0-1 remaining
  maxLife: number               // ms
  size: number                  // world units
  color: string
  alpha: number
}

interface EmitConfig {
  x: number; y: number
  count: number
  speed: { min: number; max: number }
  spread: number                // radians (Math.PI * 2 for circle)
  colors: string[]
  life: { min: number; max: number }  // ms
  size: { min: number; max: number }  // world units
}

export class ParticleSystem {
  private particles: Particle[] = []
  private maxParticles = 500

  emit(config: EmitConfig): void { ... }
  update(dt: number): void { ... }     // move, decay, filter dead
  render(ctx, camera, cellPx): void { ... }  // draw with alpha
  get count(): number { ... }
}
```

### 3.3 Render Utilities

**New file:** `client/src/rendering/RenderUtils.ts` (~80 lines)

```typescript
export function lightenColor(color: string, amount: number): string { ... }
export function shadeColor(color: string, amount: number): string { ... }  // already exists in TankRenderer, extract
export function roundRect(ctx, x, y, w, h, radius): void { ... }
export function createMetallicGradient(ctx, x, y, w, h, baseColor): CanvasGradient { ... }
```

### 3.4 Kill Feed

**New file:** `client/src/rendering/KillFeed.ts` (~70 lines)

```typescript
interface KillEntry { killerName: string; deadName: string; time: number }

export class KillFeed {
  private entries: KillEntry[] = []
  addKill(killerName: string, deadName: string): void { ... }
  render(ctx, canvasWidth): void { ... }  // top-center, last 3, fade after 5s
}
```

### 3.5 Tank Improvements

**File:** `client/src/rendering/TankRenderer.ts`

Current: flat `ctx.fillStyle = tank.color` for hull (line 66).

Add:
- **Metallic gradient:** `createLinearGradient` from lighter to darker shade on hull
- **Shadow:** Dark ellipse beneath tank (before tank transform)
- **Shield glow:** When `activePowerUp === 'shield'`, pulsing circle with `shadowBlur = 12`, rgba blue
- **Speed trails:** When `activePowerUp === 'speed'`, 2-3 fading lines behind tank

### 3.6 Bullet Improvements

**File:** `client/src/rendering/BulletRenderer.ts`

Current: single circle with `shadowBlur = 4` (lines 15-25 approximately).

Change to:
- Outer glow ring: `rgba(255, 136, 0, 0.3)`, radius × 2
- Inner core: `shadowBlur = 10`, `#FFD700`
- Trail particles: emit 1-2 small orange particles per bullet per frame via ParticleSystem

### 3.7 Map Improvements

**File:** `client/src/rendering/MapRenderer.ts`

Current: flat `#3A3A3A` background, full grid lines, basic obstacle shapes.

Change to:
- **Background:** Radial gradient `#404040` center → `#2a2a2a` edge
- **Grid:** Replace lines with dots at intersections (`rgba(255,255,255,0.06)`, 2×2px)
- **Brick:** `roundRect` with `ctx.strokeStyle` darker border, horizontal/vertical mortar lines
- **Steel:** Bevel effect — lighter top/left edge, darker bottom/right edge
- **Water:** Animated gradient overlay with two sine waves
- **Bush:** 4-5 overlapping circles with slight color variation (#2D6A4F, #40916C, #357756)

### 3.8 Explosion Improvements

**File:** `client/src/rendering/EffectsRenderer.ts`

Current: single radial gradient expanding circle.

Change to multi-phase:
- **Phase 1 (0-30%):** White flash, small radius
- **Phase 2 (20-70%):** Orange fireball, expanding
- **Phase 3 (50-100%):** Gray smoke ring, fading
- **Particles:** Emit 20-30 debris (orange, red, yellow) via ParticleSystem
- **Star pickup:** Golden particle burst + floating "+1" text

### 3.9 Zone Improvements

**File:** `client/src/rendering/ZoneRenderer.ts`

Current: flat `rgba(255, 0, 0, 0.15)` overlay.

Change to:
- Gradient edge: fade over 5 cells inward
- Animated `lineDashOffset` on border
- Subtle red particle emission at boundary

### 3.10 HUD Improvements

**File:** `client/src/rendering/HudRenderer.ts`

- Rounded semi-transparent panels (use `roundRect`)
- HP bar with green-to-red gradient
- Integrate KillFeed rendering

### 3.11 Camera Shake

**File:** `client/src/game/Camera.ts`

Add:
```typescript
private shakeOffsetX = 0
private shakeOffsetY = 0
private shakeDecay = 0

shake(intensity: number): void {
  this.shakeDecay = intensity
}

// In worldToScreen or follow(): add shakeOffset
// In update: decay shake toward 0
```

### 3.12 Wiring

**File:** `client/src/main.ts`

- Create ParticleSystem instance
- Pass to EffectsRenderer and BulletRenderer
- On kill event → KillFeed.addKill()
- On explosion → Camera.shake()
- Call particleSystem.update(dt) in game loop
- Call particleSystem.render() in render pass

**File:** `client/src/rendering/Renderer.ts`

- Store ParticleSystem reference
- Call `particleSystem.render(ctx, camera, cellPx)` after effects
- Update particle system each frame

### Verification
- Compare on 1x and 2x DPI displays — should be sharp
- 60 FPS with 30 tanks + 50 bullets + 200 particles
- Test on mobile Safari/Chrome
- Visual before/after comparison

---

## Implementation Order Summary

```
Phase 1 → Phase 2 (sequential, delta depends on binary)
Phase 3 (parallel with Phases 1-2)

Phase 1 Steps:
  1. shared/src/binary/BinaryProtocol.ts
  2. shared/src/binary/IndexMap.ts
  3. shared/src/binary/BinaryEncoder.ts
  4. shared/src/binary/BinaryDecoder.ts
  5. shared/src/protocol.ts (extend join payload)
  6. server/src/game/GameRoom.ts (IndexMap + binary state)
  7. server/src/network/RoomManager.ts (binary emit)
  8. server/src/network/SocketHandler.ts (send metadata)
  9. client/src/network/SocketClient.ts (binary detection)
  10. client/src/game/GameClient.ts (store metadata)
  11. Build & test

Phase 2 Steps:
  1. shared/src/binary/DeltaEncoder.ts + DeltaDecoder.ts
  2. server/src/network/DeltaTracker.ts + AoIFilter.ts
  3. client/src/network/ClientStateCache.ts
  4. Wire into RoomManager (per-player emit)
  5. Test bandwidth + correctness

Phase 3 Steps:
  1. DPI scaling + ParticleSystem.ts + RenderUtils.ts
  2. MapRenderer improvements
  3. TankRenderer improvements
  4. BulletRenderer improvements
  5. EffectsRenderer + ZoneRenderer + HudRenderer
  6. Camera.shake + KillFeed + wiring in main.ts
```

---

## Key Existing Types (reference)

From `shared/src/types.ts`:

```typescript
enum Direction { Up = 'up', Down = 'down', Left = 'left', Right = 'right' }
enum ObstacleType { Brick = 'brick', Steel = 'steel', Water = 'water', Bush = 'bush' }
enum PowerUpType { RapidFire = 'rapidFire', Speed = 'speed', Shield = 'shield' }
enum GamePhase { Lobby = 'lobby', Countdown = 'countdown', Playing = 'playing', Shrinking = 'shrinking', GameOver = 'gameOver' }

interface Tank {
  id: string; name: string; position: Vec2; direction: Direction
  hp: number; maxHp: number; stars: number; kills: number
  isBot: boolean; isAlive: boolean
  activePowerUp: PowerUpType | null; powerUpEndTime: number
  lastFireTime: number; fireCooldown: number; speed: number; color: string
}

interface Bullet { id: string; ownerId: string; position: Vec2; direction: Direction; distanceTraveled: number }
interface Star { id: string; position: Vec2; active: boolean; respawnAt: number }
interface PowerUp { id: string; type: PowerUpType; position: Vec2; spawnedAt: number }
interface Portal { id: string; position: Vec2; spawnedAt: number; expiresAt: number }
interface Zone { centerX: number; centerY: number; currentRadius: number; targetRadius: number; shrinkSpeed: number; phase: number; isShrinking: boolean; nextShrinkAt: number }

interface GameState {
  tick: number; timestamp: number; phase: GamePhase
  tanks: Tank[]; bullets: Bullet[]; stars: Star[]
  powerUps: PowerUp[]; portals: Portal[]; zone: Zone
  leaderboard: LeaderboardEntry[]; playersAlive: number; timeElapsed: number
}
```

## Key Constants (reference)

From `shared/src/constants.ts`:
```
MAP_WIDTH = 200, MAP_HEIGHT = 200, CELL_SIZE = 24, VIEWPORT_CELLS = 30
TANK_HP = 5, TANK_SPEED = 5, BULLET_SPEED = 10, BULLET_RANGE = 15
STARS_PER_MAP = 30, MAX_PLAYERS = 30, TICK_RATE = 20, TICK_MS = 50
TANK_COLORS = [30 hex colors]
```

## Build & Deploy

```bash
# Build
npm run build --workspace=shared && npm run build --workspace=server && npm run build --workspace=client

# Test locally
node server/dist/index.js  # port 3001

# Push triggers:
# - GitHub Actions → deploys client to GitHub Pages
# - Render.com webhook → rebuilds Docker server
git add . && git commit -m "feat: ..." && git push
```

## Rules
- Max 800 lines per file
- No console.log in production code
- TypeScript strict mode
- Keep existing game logic intact — only change serialization/rendering layers
