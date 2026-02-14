import type { Vec2 } from '../../../shared/src/types.js'
import { SpatialGrid, isWalkableCell } from '../../../shared/src/collision.js'

interface PathNode {
  x: number
  y: number
  g: number
  h: number
  f: number
  parent: PathNode | null
}

const DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 }
]

const MAX_NODES = 500

export function findPath(
  start: Vec2,
  goal: Vec2,
  grid: SpatialGrid,
  mapWidth: number,
  mapHeight: number
): Vec2[] {
  const sx = Math.round(start.x)
  const sy = Math.round(start.y)
  const gx = Math.round(goal.x)
  const gy = Math.round(goal.y)

  if (sx === gx && sy === gy) return []

  const open: PathNode[] = []
  const closed = new Set<string>()
  let nodeCount = 0

  const startNode: PathNode = {
    x: sx, y: sy,
    g: 0,
    h: heuristic(sx, sy, gx, gy),
    f: 0,
    parent: null
  }
  startNode.f = startNode.g + startNode.h
  open.push(startNode)

  while (open.length > 0 && nodeCount < MAX_NODES) {
    // Find lowest f
    let bestIdx = 0
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i
    }

    const current = open[bestIdx]
    open.splice(bestIdx, 1)

    if (current.x === gx && current.y === gy) {
      return reconstructPath(current)
    }

    const key = `${current.x},${current.y}`
    if (closed.has(key)) continue
    closed.add(key)
    nodeCount++

    for (const dir of DIRS) {
      const nx = current.x + dir.x
      const ny = current.y + dir.y
      const nkey = `${nx},${ny}`

      if (closed.has(nkey)) continue
      if (!isWalkableCell(nx, ny, grid, mapWidth, mapHeight)) continue

      const g = current.g + 1
      const h = heuristic(nx, ny, gx, gy)
      const node: PathNode = {
        x: nx, y: ny, g, h, f: g + h, parent: current
      }

      const existing = open.find(n => n.x === nx && n.y === ny)
      if (existing && existing.g <= g) continue

      open.push(node)
    }
  }

  return [] // No path found
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

function reconstructPath(node: PathNode): Vec2[] {
  const path: Vec2[] = []
  let current: PathNode | null = node
  while (current) {
    path.unshift({ x: current.x, y: current.y })
    current = current.parent
  }
  // Remove start position
  if (path.length > 0) path.shift()
  return path
}
