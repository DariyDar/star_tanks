import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

// CTF base dimensions
const BASE_W = 20
const BASE_H = 30
const BASE_MARGIN = 8

export function generateCTFMap(): MapDefinition {
  const rng = createRng(Math.random() * 1000000)
  const obstacles: Obstacle[] = []
  const occupied = new Set<string>()

  function key(x: number, y: number): string { return `${x},${y}` }

  function addObstacle(x: number, y: number, type: ObstacleType): void {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return
    const k = key(x, y)
    if (occupied.has(k)) return
    occupied.add(k)
    obstacles.push({ x, y, type, hp: type === ObstacleType.Brick ? BRICK_HP : 9999 })
  }

  // Base areas
  const baseA = { x: BASE_MARGIN, y: (MAP_HEIGHT - BASE_H) / 2, w: BASE_W, h: BASE_H }
  const baseB = { x: MAP_WIDTH - BASE_MARGIN - BASE_W, y: (MAP_HEIGHT - BASE_H) / 2, w: BASE_W, h: BASE_H }

  // Flag positions (center of each base)
  const flagA: Vec2 = { x: baseA.x + BASE_W / 2, y: baseA.y + BASE_H / 2 }
  const flagB: Vec2 = { x: baseB.x + BASE_W / 2, y: baseB.y + BASE_H / 2 }

  // Build base walls (brick, with openings)
  function buildBase(bx: number, by: number, bw: number, bh: number, openRight: boolean): void {
    // Perimeter walls
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const isEdge = dx === 0 || dx === bw - 1 || dy === 0 || dy === bh - 1
        if (!isEdge) continue

        // Opening on the side facing center
        const openSide = openRight ? dx === bw - 1 : dx === 0
        if (openSide && dy > bh / 2 - 3 && dy < bh / 2 + 3) continue // 6-tile wide door

        addObstacle(bx + dx, by + dy, ObstacleType.Brick)
      }
    }
  }

  buildBase(baseA.x, baseA.y, BASE_W, BASE_H, true)
  buildBase(baseB.x, baseB.y, BASE_W, BASE_H, false)

  // Border walls — enclose the map so players can't escape
  for (let x = 0; x < MAP_WIDTH; x++) {
    addObstacle(x, 0, ObstacleType.Steel)
    addObstacle(x, MAP_HEIGHT - 1, ObstacleType.Steel)
  }
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    addObstacle(0, y, ObstacleType.Steel)
    addObstacle(MAP_WIDTH - 1, y, ObstacleType.Steel)
  }

  // Symmetrical obstacles in the middle zone
  const midX = MAP_WIDTH / 2

  // Central brick structures — larger rooms with doorways (mirrored)
  for (let i = 0; i < 16; i++) {
    const offX = rngInt(rng, 15, midX - 10)
    const offY = rngInt(rng, 10, MAP_HEIGHT - 10)
    const w = rngInt(rng, 4, 9)
    const h = rngInt(rng, 4, 8)
    const doorSide = rngInt(rng, 0, 4) // 0=top, 1=right, 2=bottom, 3=left
    const doorPos = rngInt(rng, 1, Math.max(2, (doorSide < 2 ? w : h) - 2))

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const isEdge = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1
        if (!isEdge) continue

        // Create door opening (2-tile gap)
        let isDoor = false
        if (doorSide === 0 && dy === 0 && dx >= doorPos && dx <= doorPos + 1) isDoor = true
        if (doorSide === 2 && dy === h - 1 && dx >= doorPos && dx <= doorPos + 1) isDoor = true
        if (doorSide === 1 && dx === w - 1 && dy >= doorPos && dy <= doorPos + 1) isDoor = true
        if (doorSide === 3 && dx === 0 && dy >= doorPos && dy <= doorPos + 1) isDoor = true
        if (isDoor) continue

        addObstacle(midX - offX + dx, offY + dy, ObstacleType.Brick)
        addObstacle(midX + offX - dx, offY + dy, ObstacleType.Brick)
      }
    }
  }

  // Brick wall segments — more of them, longer (mirrored)
  for (let i = 0; i < 70; i++) {
    const offX = rngInt(rng, 5, midX - 5)
    const offY = rngInt(rng, 5, MAP_HEIGHT - 5)
    const horizontal = rng() < 0.5
    const len = rngInt(rng, 3, 10)

    for (let j = 0; j < len; j++) {
      if (horizontal) {
        addObstacle(midX - offX + j, offY, ObstacleType.Brick)
        addObstacle(midX + offX - j, offY, ObstacleType.Brick)
      } else {
        addObstacle(midX - offX, offY + j, ObstacleType.Brick)
        addObstacle(midX + offX, offY + j, ObstacleType.Brick)
      }
    }
  }

  // L-shaped and T-shaped fortifications (mirrored)
  for (let i = 0; i < 8; i++) {
    const offX = rngInt(rng, 20, midX - 15)
    const offY = rngInt(rng, 15, MAP_HEIGHT - 15)
    const armLen = rngInt(rng, 3, 6)

    // Horizontal arm
    for (let j = 0; j < armLen; j++) {
      addObstacle(midX - offX + j, offY, ObstacleType.Brick)
      addObstacle(midX + offX - j, offY, ObstacleType.Brick)
    }
    // Vertical arm (from one end)
    for (let j = 1; j <= armLen; j++) {
      addObstacle(midX - offX, offY + j, ObstacleType.Brick)
      addObstacle(midX + offX, offY + j, ObstacleType.Brick)
    }
  }

  // Small bunkers near bases — 3x3 rooms with one opening (mirrored)
  for (let i = 0; i < 4; i++) {
    const offX = rngInt(rng, 32, midX - 20)
    const offY = rngInt(rng, 20, MAP_HEIGHT - 20)
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const isEdge = dx === 0 || dx === 2 || dy === 0 || dy === 2
        if (!isEdge) continue
        if (dy === 2 && dx === 1) continue // door at bottom center
        addObstacle(midX - offX + dx, offY + dy, ObstacleType.Brick)
        addObstacle(midX + offX - dx, offY + dy, ObstacleType.Brick)
      }
    }
  }

  // Bush cover (mirrored)
  for (let i = 0; i < 15; i++) {
    const offX = rngInt(rng, 10, midX - 5)
    const offY = rngInt(rng, 10, MAP_HEIGHT - 10)
    const r = rngInt(rng, 2, 4)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.5) {
          addObstacle(midX - offX + dx, offY + dy, ObstacleType.Bush)
          addObstacle(midX + offX - dx, offY + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Small water features (mirrored, non-enclosing)
  for (let i = 0; i < 4; i++) {
    const offX = rngInt(rng, 25, midX - 10)
    const offY = rngInt(rng, 25, MAP_HEIGHT - 25)
    const r = rngInt(rng, 1, 2)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          addObstacle(midX - offX + dx, offY + dy, ObstacleType.Water)
          addObstacle(midX + offX - dx, offY + dy, ObstacleType.Water)
        }
      }
    }
  }

  // Quicksand in the middle corridor
  for (let i = 0; i < 4; i++) {
    const qx = rngInt(rng, midX - 15, midX + 15)
    const qy = rngInt(rng, 30, MAP_HEIGHT - 30)
    const w = rngInt(rng, 2, 4)
    const h = rngInt(rng, 2, 4)
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (rng() < 0.6) addObstacle(qx + dx, qy + dy, ObstacleType.Quicksand)
      }
    }
  }

  // Spawn points - team A on left, team B on right
  const spawnPointsA: Vec2[] = []
  const spawnPointsB: Vec2[] = []

  // Team A spawns (left side)
  for (let attempt = 0, count = 0; count < 10 && attempt < 500; attempt++) {
    const x = rngInt(rng, baseA.x + 2, baseA.x + BASE_W - 2)
    const y = rngInt(rng, baseA.y + 2, baseA.y + BASE_H - 2)
    if (occupied.has(key(x, y))) continue
    let tooClose = false
    for (const p of spawnPointsA) {
      if (distance(p, { x, y }) < 5) { tooClose = true; break }
    }
    if (tooClose) continue
    spawnPointsA.push({ x, y })
    count++
  }

  // Team B spawns (right side)
  for (let attempt = 0, count = 0; count < 10 && attempt < 500; attempt++) {
    const x = rngInt(rng, baseB.x + 2, baseB.x + BASE_W - 2)
    const y = rngInt(rng, baseB.y + 2, baseB.y + BASE_H - 2)
    if (occupied.has(key(x, y))) continue
    let tooClose = false
    for (const p of spawnPointsB) {
      if (distance(p, { x, y }) < 5) { tooClose = true; break }
    }
    if (tooClose) continue
    spawnPointsB.push({ x, y })
    count++
  }

  // Combined spawn points for the generic field
  const spawnPoints = [...spawnPointsA, ...spawnPointsB]

  // Stars in the middle zone
  const starPositions = generateStarPositions(rng, occupied, STARS_PER_MAP)

  return {
    name: 'Захват Флага',
    id: 'ctf',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    botCount: 6,
    obstacles,
    spawnPoints,
    starPositions,
    spawnPointsA,
    spawnPointsB,
    flagPositionA: flagA,
    flagPositionB: flagB,
    baseA,
    baseB
  }
}

function generateStarPositions(rng: () => number, occupied: Set<string>, count: number): Vec2[] {
  const positions: Vec2[] = []
  // Stars spawn in the middle 60% of the map
  const minX = Math.floor(MAP_WIDTH * 0.2)
  const maxX = Math.floor(MAP_WIDTH * 0.8)

  for (let attempt = 0; positions.length < count && attempt < 500; attempt++) {
    const x = rngInt(rng, minX, maxX)
    const y = rngInt(rng, 5, MAP_HEIGHT - 5)
    if (!occupied.has(`${x},${y}`)) {
      positions.push({ x, y })
    }
  }
  return positions
}
