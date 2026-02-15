import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

export function generateMegapolisMap(): MapDefinition {
  const rng = createRng(42_002)
  const obstacleMap = new Map<string, Obstacle>()

  function key(x: number, y: number): string { return `${x},${y}` }

  function addObstacle(x: number, y: number, type: ObstacleType): void {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return
    const k = key(x, y)
    if (obstacleMap.has(k)) return
    obstacleMap.set(k, { x, y, type, hp: type === ObstacleType.Brick ? BRICK_HP : 9999 })
  }

  function removeObstacle(x: number, y: number): void {
    obstacleMap.delete(key(x, y))
  }

  function makeDoor(startX: number, startY: number, w: number, h: number, side: number): void {
    const dim = side < 2 ? w : h
    if (dim <= 5) return
    const pos = rngInt(rng, 1, dim - 3)
    for (let d = 0; d < 2; d++) {
      if (side === 0) removeObstacle(startX + pos + d, startY)
      else if (side === 1) removeObstacle(startX + pos + d, startY + h - 1)
      else if (side === 2) removeObstacle(startX, startY + pos + d)
      else removeObstacle(startX + w - 1, startY + pos + d)
    }
  }

  // City grid — smaller blocks for 200x200
  const blockSize = 12
  const streetWidth = 4

  for (let by = 0; by * (blockSize + streetWidth) < MAP_HEIGHT - 10; by++) {
    for (let bx = 0; bx * (blockSize + streetWidth) < MAP_WIDTH - 10; bx++) {
      const startX = 5 + bx * (blockSize + streetWidth)
      const startY = 5 + by * (blockSize + streetWidth)

      if (rng() < 0.15) continue  // Reduced skip chance for more obstacles

      const buildingType = rng()

      if (buildingType < 0.45) {
        // Hollow brick building
        const w = rngInt(rng, 5, 9)
        const h = rngInt(rng, 5, 8)
        const ox = startX + rngInt(rng, 0, Math.max(0, blockSize - w))
        const oy = startY + rngInt(rng, 0, Math.max(0, blockSize - h))

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1) {
              addObstacle(ox + dx, oy + dy, ObstacleType.Brick)
            }
          }
        }
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))

      } else if (buildingType < 0.6) {
        // Steel bunker
        const w = rngInt(rng, 2, 4)
        const h = rngInt(rng, 2, 4)
        const ox = startX + rngInt(rng, 1, Math.max(2, blockSize - w - 1))
        const oy = startY + rngInt(rng, 1, Math.max(2, blockSize - h - 1))

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            addObstacle(ox + dx, oy + dy, ObstacleType.Steel)
          }
        }

      } else if (buildingType < 0.75) {
        // Park
        const w = rngInt(rng, 4, 8)
        const h = rngInt(rng, 4, 8)
        const ox = startX + rngInt(rng, 0, Math.max(0, blockSize - w))
        const oy = startY + rngInt(rng, 0, Math.max(0, blockSize - h))

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (rng() < 0.5) addObstacle(ox + dx, oy + dy, ObstacleType.Bush)
          }
        }

      } else {
        // Mixed building
        const w = rngInt(rng, 5, 8)
        const h = rngInt(rng, 5, 8)
        const ox = startX + rngInt(rng, 0, Math.max(0, blockSize - w))
        const oy = startY + rngInt(rng, 0, Math.max(0, blockSize - h))

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const isEdge = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1
            const isCorner = (dx < 1 || dx >= w - 1) && (dy < 1 || dy >= h - 1)
            if (isCorner) addObstacle(ox + dx, oy + dy, ObstacleType.Steel)
            else if (isEdge) addObstacle(ox + dx, oy + dy, ObstacleType.Brick)
          }
        }
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))
      }
    }
  }

  // One water channel
  const horizontal = rng() < 0.5
  const pos = rngInt(rng, 60, MAP_WIDTH - 60)
  const width = rngInt(rng, 2, 3)

  if (horizontal) {
    for (let x = 20; x < MAP_WIDTH - 20; x++) {
      for (let w = 0; w < width; w++) addObstacle(x, pos + w, ObstacleType.Water)
    }
  } else {
    for (let y = 20; y < MAP_HEIGHT - 20; y++) {
      for (let w = 0; w < width; w++) addObstacle(pos + w, y, ObstacleType.Water)
    }
  }

  const occupied = new Set(obstacleMap.keys())
  const obstacles = Array.from(obstacleMap.values())
  const spawnPoints = generateSpawnPoints(rng, occupied, 20)
  const starPositions = generateStarPositions(rng, occupied, STARS_PER_MAP)

  return {
    name: 'Мегаполис',
    id: 'megapolis',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    botCount: 5,
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
