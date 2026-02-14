import { ObstacleType, type MapDefinition, type Obstacle, type Vec2 } from '../types.js'
import { createRng, rngInt, distance } from '../math.js'
import { MAP_WIDTH, MAP_HEIGHT, STARS_PER_MAP, BRICK_HP } from '../constants.js'

export function generateMegapolisMap(): MapDefinition {
  const rng = createRng(42_002)
  // Use a Map for O(1) add/remove by coordinate key
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
    const pos = rngInt(rng, 3, (side < 2 ? w : h) - 4)
    for (let d = 0; d < 3; d++) {
      if (side === 0) removeObstacle(startX + pos + d, startY)
      else if (side === 1) removeObstacle(startX + pos + d, startY + h - 1)
      else if (side === 2) removeObstacle(startX, startY + pos + d)
      else removeObstacle(startX + w - 1, startY + pos + d)
    }
  }

  // City grid with bigger blocks and wider streets for less density
  const blockSize = 50
  const streetWidth = 8

  for (let by = 0; by * (blockSize + streetWidth) < MAP_HEIGHT - 100; by++) {
    for (let bx = 0; bx * (blockSize + streetWidth) < MAP_WIDTH - 100; bx++) {
      const startX = 100 + bx * (blockSize + streetWidth)
      const startY = 100 + by * (blockSize + streetWidth)

      // Skip ~30% blocks for open plazas/streets
      if (rng() < 0.3) continue

      const buildingType = rng()

      if (buildingType < 0.45) {
        // Hollow brick building (only walls)
        const w = rngInt(rng, 15, 30)
        const h = rngInt(rng, 15, 25)
        const ox = startX + rngInt(rng, 0, blockSize - w)
        const oy = startY + rngInt(rng, 0, blockSize - h)

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1) {
              addObstacle(ox + dx, oy + dy, ObstacleType.Brick)
            }
          }
        }
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))

      } else if (buildingType < 0.6) {
        // Small steel bunker
        const w = rngInt(rng, 4, 8)
        const h = rngInt(rng, 4, 8)
        const ox = startX + rngInt(rng, 5, blockSize - w - 5)
        const oy = startY + rngInt(rng, 5, blockSize - h - 5)

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            addObstacle(ox + dx, oy + dy, ObstacleType.Steel)
          }
        }

      } else if (buildingType < 0.75) {
        // Park
        const w = rngInt(rng, 12, 25)
        const h = rngInt(rng, 12, 25)
        const ox = startX + rngInt(rng, 0, blockSize - w)
        const oy = startY + rngInt(rng, 0, blockSize - h)

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (rng() < 0.5) addObstacle(ox + dx, oy + dy, ObstacleType.Bush)
          }
        }

      } else {
        // Mixed building: steel corners, brick walls
        const w = rngInt(rng, 15, 25)
        const h = rngInt(rng, 15, 25)
        const ox = startX + rngInt(rng, 0, blockSize - w)
        const oy = startY + rngInt(rng, 0, blockSize - h)

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const isEdge = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1
            const isCorner = (dx < 2 || dx >= w - 2) && (dy < 2 || dy >= h - 2)
            if (isCorner) addObstacle(ox + dx, oy + dy, ObstacleType.Steel)
            else if (isEdge) addObstacle(ox + dx, oy + dy, ObstacleType.Brick)
          }
        }
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))
        makeDoor(ox, oy, w, h, rngInt(rng, 0, 3))
      }
    }
  }

  // Two narrow water channels
  for (let i = 0; i < 2; i++) {
    const horizontal = rng() < 0.5
    const pos = rngInt(rng, 600, MAP_WIDTH - 600)
    const width = rngInt(rng, 3, 5)

    if (horizontal) {
      for (let x = 200; x < MAP_WIDTH - 200; x++) {
        for (let w = 0; w < width; w++) addObstacle(x, pos + w, ObstacleType.Water)
      }
    } else {
      for (let y = 200; y < MAP_HEIGHT - 200; y++) {
        for (let w = 0; w < width; w++) addObstacle(pos + w, y, ObstacleType.Water)
      }
    }
  }

  const occupied = new Set(obstacleMap.keys())
  const obstacles = Array.from(obstacleMap.values())
  const spawnPoints = generateSpawnPoints(rng, occupied, 40)
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
