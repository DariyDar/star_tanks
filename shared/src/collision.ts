import { ObstacleType, type Obstacle, type Vec2 } from './types.js'

export class SpatialGrid {
  private buckets: Map<number, Obstacle[]> = new Map()
  private bucketSize: number
  private mapWidth: number

  constructor(mapWidth: number, mapHeight: number, bucketSize = 100) {
    this.bucketSize = bucketSize
    this.mapWidth = mapWidth
  }

  private key(bx: number, by: number): number {
    return by * Math.ceil(this.mapWidth / this.bucketSize) + bx
  }

  add(obstacle: Obstacle): void {
    const bx = Math.floor(obstacle.x / this.bucketSize)
    const by = Math.floor(obstacle.y / this.bucketSize)
    const k = this.key(bx, by)
    let bucket = this.buckets.get(k)
    if (!bucket) {
      bucket = []
      this.buckets.set(k, bucket)
    }
    bucket.push(obstacle)
  }

  remove(obstacle: Obstacle): boolean {
    const bx = Math.floor(obstacle.x / this.bucketSize)
    const by = Math.floor(obstacle.y / this.bucketSize)
    const bucket = this.buckets.get(this.key(bx, by))
    if (!bucket) return false
    const idx = bucket.indexOf(obstacle)
    if (idx === -1) return false
    bucket.splice(idx, 1)
    return true
  }

  getAt(x: number, y: number): Obstacle | undefined {
    const bx = Math.floor(x / this.bucketSize)
    const by = Math.floor(y / this.bucketSize)
    const bucket = this.buckets.get(this.key(bx, by))
    return bucket?.find(o => o.x === x && o.y === y)
  }

  getInRect(x1: number, y1: number, x2: number, y2: number): Obstacle[] {
    const results: Obstacle[] = []
    const bx1 = Math.floor(x1 / this.bucketSize)
    const by1 = Math.floor(y1 / this.bucketSize)
    const bx2 = Math.floor(x2 / this.bucketSize)
    const by2 = Math.floor(y2 / this.bucketSize)
    for (let by = by1; by <= by2; by++) {
      for (let bx = bx1; bx <= bx2; bx++) {
        const bucket = this.buckets.get(this.key(bx, by))
        if (!bucket) continue
        for (const o of bucket) {
          if (o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2) {
            results.push(o)
          }
        }
      }
    }
    return results
  }

  clear(): void {
    this.buckets.clear()
  }

  get size(): number {
    let count = 0
    for (const bucket of this.buckets.values()) {
      count += bucket.length
    }
    return count
  }
}

export function isBlockingMovement(type: ObstacleType): boolean {
  return type !== ObstacleType.Bush && type !== ObstacleType.Quicksand
}

export function isBlockingBullet(type: ObstacleType): boolean {
  return type === ObstacleType.Brick || type === ObstacleType.Steel
}

export function isDestructible(type: ObstacleType): boolean {
  return type === ObstacleType.Brick
}

export function isHidingTank(type: ObstacleType): boolean {
  return type === ObstacleType.Bush
}

export function isWalkableCell(
  x: number, y: number,
  grid: SpatialGrid,
  mapWidth: number,
  mapHeight: number
): boolean {
  if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return false
  const obs = grid.getAt(x, y)
  if (!obs) return true
  return !isBlockingMovement(obs.type)
}
