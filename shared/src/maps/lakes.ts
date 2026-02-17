import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

export function generateLakesMap(): MapDefinition {
  // Use random seed for map variety each game
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

  // 3 lakes (crescent/half-moon shapes - never fully enclosing)
  for (let i = 0; i < 3; i++) {
    const cx = rngInt(rng, 30, MAP_WIDTH - 30)
    const cy = rngInt(rng, 30, MAP_HEIGHT - 30)
    const rx = rngInt(rng, 4, 7)
    const ry = rngInt(rng, 3, 6)
    const openSide = rngInt(rng, 0, 3) // 0=top, 1=bottom, 2=left, 3=right

    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const nx = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry)
        if (nx > 1.0) continue
        // Leave one side open so water never encloses
        if (openSide === 0 && dy < -ry / 2) continue
        if (openSide === 1 && dy > ry / 2) continue
        if (openSide === 2 && dx < -rx / 2) continue
        if (openSide === 3 && dx > rx / 2) continue
        addObstacle(cx + dx, cy + dy, ObstacleType.Water)
      }
    }

    // Bush ring around lake (sparse)
    for (let dy = -ry - 2; dy <= ry + 2; dy++) {
      for (let dx = -rx - 2; dx <= rx + 2; dx++) {
        const nx = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry)
        if (nx > 1.0 && nx <= 1.5 && rng() < 0.35) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // 8 small ponds (tiny, not enclosing)
  for (let i = 0; i < 8; i++) {
    const cx = rngInt(rng, 15, MAP_WIDTH - 15)
    const cy = rngInt(rng, 15, MAP_HEIGHT - 15)
    const r = rngInt(rng, 1, 2)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.8) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Water)
        }
      }
    }
  }

  // Brick walls (scattered) - 3 rows thick for solid cover
  for (let i = 0; i < 180; i++) {
    const x = rngInt(rng, 5, MAP_WIDTH - 10)
    const y = rngInt(rng, 5, MAP_HEIGHT - 10)
    const horizontal = rng() < 0.5
    const len = rngInt(rng, 3, 8)

    for (let j = 0; j < len; j++) {
      if (horizontal) {
        addObstacle(x + j, y - 1, ObstacleType.Brick)
        addObstacle(x + j, y, ObstacleType.Brick)
        addObstacle(x + j, y + 1, ObstacleType.Brick)
      } else {
        addObstacle(x - 1, y + j, ObstacleType.Brick)
        addObstacle(x, y + j, ObstacleType.Brick)
        addObstacle(x + 1, y + j, ObstacleType.Brick)
      }
    }
  }

  // Brick boulders (breakable cover) — larger
  for (let i = 0; i < 40; i++) {
    const cx = rngInt(rng, 10, MAP_WIDTH - 10)
    const cy = rngInt(rng, 10, MAP_HEIGHT - 10)
    const size = rngInt(rng, 2, 4)

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        addObstacle(cx + dx, cy + dy, ObstacleType.Brick)
      }
    }
  }

  // Bush patches - increased for more concealment
  for (let i = 0; i < 25; i++) {
    const cx = rngInt(rng, 10, MAP_WIDTH - 10)
    const cy = rngInt(rng, 10, MAP_HEIGHT - 10)
    const r = rngInt(rng, 2, 5)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.5) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Quicksand patches scattered around the map
  for (let i = 0; i < 8; i++) {
    const cx = rngInt(rng, 25, MAP_WIDTH - 25)
    const cy = rngInt(rng, 25, MAP_HEIGHT - 25)
    const w = rngInt(rng, 3, 6)
    const h = rngInt(rng, 3, 6)

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (rng() < 0.7) {  // 70% density for irregular patches
          addObstacle(cx + dx, cy + dy, ObstacleType.Quicksand)
        }
      }
    }
  }

  const spawnPoints = generateSpawnPoints(rng, occupied, 20)
  const starPositions = generateStarPositions(rng, occupied, STARS_PER_MAP)

  return {
    name: 'Озёра',
    id: 'lakes',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    botCount: 10,
    obstacles,
    spawnPoints,
    starPositions
  }
}

function generateSpawnPoints(rng: () => number, occupied: Set<string>, count: number): Vec2[] {
  const points: Vec2[] = []
  let attempts = 0

  while (points.length < count && attempts < 5000) {
    const x = rngInt(rng, 5, MAP_WIDTH - 5)
    const y = rngInt(rng, 5, MAP_HEIGHT - 5)
    attempts++

    if (occupied.has(`${x},${y}`)) continue

    let tooClose = false
    for (const p of points) {
      if (distance(p, { x, y }) < 10) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue

    points.push({ x, y })
  }

  return points
}

function generateStarPositions(rng: () => number, occupied: Set<string>, count: number): Vec2[] {
  const positions: Vec2[] = []
  const gridSize = Math.ceil(Math.sqrt(count))
  const cellW = Math.max(2, Math.floor(MAP_WIDTH / gridSize))
  const cellH = Math.max(2, Math.floor(MAP_HEIGHT / gridSize))

  for (let gy = 0; gy < gridSize && positions.length < count; gy++) {
    for (let gx = 0; gx < gridSize && positions.length < count; gx++) {
      let placed = false
      for (let attempt = 0; attempt < 50 && !placed; attempt++) {
        const x = gx * cellW + rngInt(rng, 1, Math.max(2, cellW - 1))
        const y = gy * cellH + rngInt(rng, 1, Math.max(2, cellH - 1))
        if (!occupied.has(`${x},${y}`) && x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT) {
          positions.push({ x, y })
          placed = true
        }
      }
    }
  }

  return positions
}
