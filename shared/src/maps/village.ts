import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

export function generateVillageMap(): MapDefinition {
  const rng = createRng(42_003)
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

  // River running diagonally through the map
  const riverStartX = rngInt(rng, 0, 40)
  const riverEndX = rngInt(rng, MAP_WIDTH - 40, MAP_WIDTH)
  const riverWidth = rngInt(rng, 2, 4)

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const progress = y / MAP_HEIGHT
    const centerX = Math.round(riverStartX + (riverEndX - riverStartX) * progress
      + Math.sin(progress * Math.PI * 4) * 10)
    for (let w = -Math.floor(riverWidth / 2); w <= Math.floor(riverWidth / 2); w++) {
      addObstacle(centerX + w, y, ObstacleType.Water)
    }
  }

  // Small ponds near river
  for (let i = 0; i < 3; i++) {
    const progress = rng()
    const riverX = Math.round(riverStartX + (riverEndX - riverStartX) * progress
      + Math.sin(progress * Math.PI * 4) * 10)
    const side = rng() < 0.5 ? -1 : 1
    const cx = riverX + side * rngInt(rng, 8, 20)
    const cy = Math.round(progress * MAP_HEIGHT)
    const r = rngInt(rng, 2, 4)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Water)
        }
      }
    }
  }

  // Village houses (brick, small, scattered in clusters)
  const villageCenters: Vec2[] = []
  for (let i = 0; i < 5; i++) {
    villageCenters.push({
      x: rngInt(rng, 20, MAP_WIDTH - 20),
      y: rngInt(rng, 20, MAP_HEIGHT - 20)
    })
  }

  for (const center of villageCenters) {
    const houseCount = rngInt(rng, 2, 4)

    for (let h = 0; h < houseCount; h++) {
      const hx = center.x + rngInt(rng, -10, 10)
      const hy = center.y + rngInt(rng, -10, 10)
      const hw = rngInt(rng, 4, 7)
      const hh = rngInt(rng, 4, 6)

      for (let dy = 0; dy < hh; dy++) {
        for (let dx = 0; dx < hw; dx++) {
          const isEdge = dx === 0 || dx === hw - 1 || dy === 0 || dy === hh - 1
          if (isEdge) {
            addObstacle(hx + dx, hy + dy, ObstacleType.Brick)
          }
        }
      }

      // Door opening
      const doorSide = rngInt(rng, 0, 3)
      const dim = doorSide < 2 ? hw : hh
      if (dim > 3) {
        const doorPos = rngInt(rng, 1, dim - 2)
        for (let d = 0; d < 2 && doorPos + d < dim - 1; d++) {
          let ox: number, oy: number
          if (doorSide === 0) { ox = hx + doorPos + d; oy = hy }
          else if (doorSide === 1) { ox = hx + doorPos + d; oy = hy + hh - 1 }
          else if (doorSide === 2) { ox = hx; oy = hy + doorPos + d }
          else { ox = hx + hw - 1; oy = hy + doorPos + d }
          const k2 = key(ox, oy)
          occupied.delete(k2)
          const idx = obstacles.findIndex(o => o.x === ox && o.y === oy)
          if (idx !== -1) obstacles.splice(idx, 1)
        }
      }
    }

    // Stone walls (steel)
    const wallCount = rngInt(rng, 1, 2)
    for (let w = 0; w < wallCount; w++) {
      const wx = center.x + rngInt(rng, -15, 15)
      const wy = center.y + rngInt(rng, -15, 15)
      const horizontal = rng() < 0.5
      const len = rngInt(rng, 3, 8)

      for (let j = 0; j < len; j++) {
        if (horizontal) addObstacle(wx + j, wy, ObstacleType.Steel)
        else addObstacle(wx, wy + j, ObstacleType.Steel)
      }
    }
  }

  // Farm fields (bush rows)
  for (let i = 0; i < 8; i++) {
    const fx = rngInt(rng, 10, MAP_WIDTH - 30)
    const fy = rngInt(rng, 10, MAP_HEIGHT - 30)
    const rows = rngInt(rng, 2, 5)
    const rowLen = rngInt(rng, 5, 15)
    const rowGap = rngInt(rng, 2, 3)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < rowLen; col++) {
        if (rng() < 0.7) {
          addObstacle(fx + col, fy + row * rowGap, ObstacleType.Bush)
        }
      }
    }
  }

  // Forest patches
  for (let i = 0; i < 6; i++) {
    const cx = rngInt(rng, 15, MAP_WIDTH - 15)
    const cy = rngInt(rng, 15, MAP_HEIGHT - 15)
    const r = rngInt(rng, 3, 6)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.65) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Scattered brick walls
  for (let i = 0; i < 10; i++) {
    const x = rngInt(rng, 5, MAP_WIDTH - 10)
    const y = rngInt(rng, 5, MAP_HEIGHT - 10)
    const horizontal = rng() < 0.5
    const len = rngInt(rng, 2, 5)

    for (let j = 0; j < len; j++) {
      if (horizontal) addObstacle(x + j, y, ObstacleType.Brick)
      else addObstacle(x, y + j, ObstacleType.Brick)
    }
  }

  const spawnPoints = generateSpawnPoints(rng, occupied, 20)
  const starPositions = generateStarPositions(rng, occupied, STARS_PER_MAP)

  return {
    name: 'Село',
    id: 'village',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    botCount: 0,
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
      if (distance(p, { x, y }) < 10) { tooClose = true; break }
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
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = gx * cellW + rngInt(rng, 1, Math.max(2, cellW - 1))
        const y = gy * cellH + rngInt(rng, 1, Math.max(2, cellH - 1))
        if (!occupied.has(`${x},${y}`) && x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT) {
          positions.push({ x, y })
          break
        }
      }
    }
  }
  return positions
}
