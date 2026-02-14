import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

export function generateLakesMap(): MapDefinition {
  const rng = createRng(42_001)
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

  // Generate 10 large lakes (water ellipses)
  for (let i = 0; i < 10; i++) {
    const cx = rngInt(rng, 200, MAP_WIDTH - 200)
    const cy = rngInt(rng, 200, MAP_HEIGHT - 200)
    const rx = rngInt(rng, 40, 100)
    const ry = rngInt(rng, 30, 80)

    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const nx = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry)
        if (nx <= 1.0) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Water)
        }
      }
    }

    // Bush ring around lake
    for (let dy = -ry - 4; dy <= ry + 4; dy++) {
      for (let dx = -rx - 4; dx <= rx + 4; dx++) {
        const nx = (dx / rx) * (dx / rx) + (dy / ry) * (dy / ry)
        if (nx > 1.0 && nx <= 1.3 && rng() < 0.4) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Generate 20 small ponds
  for (let i = 0; i < 20; i++) {
    const cx = rngInt(rng, 100, MAP_WIDTH - 100)
    const cy = rngInt(rng, 100, MAP_HEIGHT - 100)
    const r = rngInt(rng, 10, 25)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Water)
        }
      }
    }
  }

  // Brick paths between lakes (scattered walls)
  for (let i = 0; i < 60; i++) {
    const x = rngInt(rng, 50, MAP_WIDTH - 50)
    const y = rngInt(rng, 50, MAP_HEIGHT - 50)
    const horizontal = rng() < 0.5
    const len = rngInt(rng, 5, 20)

    for (let j = 0; j < len; j++) {
      if (horizontal) {
        addObstacle(x + j, y, ObstacleType.Brick)
      } else {
        addObstacle(x, y + j, ObstacleType.Brick)
      }
    }
  }

  // Steel boulders (landmarks)
  for (let i = 0; i < 30; i++) {
    const cx = rngInt(rng, 100, MAP_WIDTH - 100)
    const cy = rngInt(rng, 100, MAP_HEIGHT - 100)
    const size = rngInt(rng, 2, 5)

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        addObstacle(cx + dx, cy + dy, ObstacleType.Steel)
      }
    }
  }

  // Scattered bush patches
  for (let i = 0; i < 80; i++) {
    const cx = rngInt(rng, 50, MAP_WIDTH - 50)
    const cy = rngInt(rng, 50, MAP_HEIGHT - 50)
    const r = rngInt(rng, 5, 15)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.5) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Spawn points (evenly distributed, on walkable ground)
  const spawnPoints = generateSpawnPoints(rng, occupied, 40)

  // Star positions
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
  const minDist = 150
  let attempts = 0

  while (points.length < count && attempts < 5000) {
    const x = rngInt(rng, 50, MAP_WIDTH - 50)
    const y = rngInt(rng, 50, MAP_HEIGHT - 50)
    attempts++

    if (occupied.has(`${x},${y}`)) continue

    let tooClose = false
    for (const p of points) {
      if (distance(p, { x, y }) < minDist) {
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
  const cellW = Math.floor(MAP_WIDTH / gridSize)
  const cellH = Math.floor(MAP_HEIGHT / gridSize)

  for (let gy = 0; gy < gridSize && positions.length < count; gy++) {
    for (let gx = 0; gx < gridSize && positions.length < count; gx++) {
      let placed = false
      for (let attempt = 0; attempt < 50 && !placed; attempt++) {
        const x = gx * cellW + rngInt(rng, 10, cellW - 10)
        const y = gy * cellH + rngInt(rng, 10, cellH - 10)
        if (!occupied.has(`${x},${y}`) && x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT) {
          positions.push({ x, y })
          placed = true
        }
      }
    }
  }

  return positions
}
