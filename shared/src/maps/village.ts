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
  const riverStartX = rngInt(rng, 0, 500)
  const riverEndX = rngInt(rng, MAP_WIDTH - 500, MAP_WIDTH)
  const riverWidth = rngInt(rng, 8, 14)

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const progress = y / MAP_HEIGHT
    const centerX = Math.round(riverStartX + (riverEndX - riverStartX) * progress
      + Math.sin(progress * Math.PI * 4) * 80) // meander
    for (let w = -Math.floor(riverWidth / 2); w <= Math.floor(riverWidth / 2); w++) {
      addObstacle(centerX + w, y, ObstacleType.Water)
    }
  }

  // Small ponds near river
  for (let i = 0; i < 8; i++) {
    const progress = rng()
    const riverX = Math.round(riverStartX + (riverEndX - riverStartX) * progress
      + Math.sin(progress * Math.PI * 4) * 80)
    const side = rng() < 0.5 ? -1 : 1
    const cx = riverX + side * rngInt(rng, 30, 80)
    const cy = Math.round(progress * MAP_HEIGHT)
    const r = rngInt(rng, 8, 20)

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
  for (let i = 0; i < 15; i++) {
    villageCenters.push({
      x: rngInt(rng, 200, MAP_WIDTH - 200),
      y: rngInt(rng, 200, MAP_HEIGHT - 200)
    })
  }

  for (const center of villageCenters) {
    const houseCount = rngInt(rng, 3, 8)

    for (let h = 0; h < houseCount; h++) {
      const hx = center.x + rngInt(rng, -60, 60)
      const hy = center.y + rngInt(rng, -60, 60)
      const hw = rngInt(rng, 6, 12)
      const hh = rngInt(rng, 6, 10)

      // Brick walls of the house
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
      const doorPos = rngInt(rng, 2, (doorSide < 2 ? hw : hh) - 3)
      for (let d = 0; d < 2; d++) {
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

    // Stone walls (steel) along paths between houses
    const wallCount = rngInt(rng, 1, 3)
    for (let w = 0; w < wallCount; w++) {
      const wx = center.x + rngInt(rng, -80, 80)
      const wy = center.y + rngInt(rng, -80, 80)
      const horizontal = rng() < 0.5
      const len = rngInt(rng, 8, 25)

      for (let j = 0; j < len; j++) {
        if (horizontal) addObstacle(wx + j, wy, ObstacleType.Steel)
        else addObstacle(wx, wy + j, ObstacleType.Steel)
      }

      // Gate opening in the wall
      const gatePos = rngInt(rng, 2, len - 3)
      for (let g = 0; g < 2; g++) {
        let gx: number, gy: number
        if (horizontal) { gx = wx + gatePos + g; gy = wy }
        else { gx = wx; gy = wy + gatePos + g }
        const k2 = key(gx, gy)
        occupied.delete(k2)
        const idx = obstacles.findIndex(o => o.x === gx && o.y === gy)
        if (idx !== -1) obstacles.splice(idx, 1)
      }
    }
  }

  // Farm fields (bush rows in patterns)
  for (let i = 0; i < 25; i++) {
    const fx = rngInt(rng, 100, MAP_WIDTH - 200)
    const fy = rngInt(rng, 100, MAP_HEIGHT - 200)
    const rows = rngInt(rng, 4, 10)
    const rowLen = rngInt(rng, 20, 60)
    const rowGap = rngInt(rng, 3, 6)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < rowLen; col++) {
        if (rng() < 0.7) {
          addObstacle(fx + col, fy + row * rowGap, ObstacleType.Bush)
        }
      }
    }
  }

  // Forest patches (dense bush areas)
  for (let i = 0; i < 20; i++) {
    const cx = rngInt(rng, 100, MAP_WIDTH - 100)
    const cy = rngInt(rng, 100, MAP_HEIGHT - 100)
    const r = rngInt(rng, 15, 40)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && rng() < 0.65) {
          addObstacle(cx + dx, cy + dy, ObstacleType.Bush)
        }
      }
    }
  }

  // Additional scattered brick walls
  for (let i = 0; i < 30; i++) {
    const x = rngInt(rng, 50, MAP_WIDTH - 50)
    const y = rngInt(rng, 50, MAP_HEIGHT - 50)
    const horizontal = rng() < 0.5
    const len = rngInt(rng, 3, 12)

    for (let j = 0; j < len; j++) {
      if (horizontal) addObstacle(x + j, y, ObstacleType.Brick)
      else addObstacle(x, y + j, ObstacleType.Brick)
    }
  }

  const spawnPoints = generateSpawnPoints(rng, occupied, 40)
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
    const x = rngInt(rng, 50, MAP_WIDTH - 50)
    const y = rngInt(rng, 50, MAP_HEIGHT - 50)
    attempts++
    if (occupied.has(`${x},${y}`)) continue
    let tooClose = false
    for (const p of points) {
      if (distance(p, { x, y }) < 150) { tooClose = true; break }
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
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = gx * cellW + rngInt(rng, 10, cellW - 10)
        const y = gy * cellH + rngInt(rng, 10, cellH - 10)
        if (!occupied.has(`${x},${y}`) && x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT) {
          positions.push({ x, y })
          break
        }
      }
    }
  }
  return positions
}
