import { Direction, type Vec2 } from './types.js'

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function manhattanDistance(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function directionToVec(dir: Direction): Vec2 {
  switch (dir) {
    case Direction.Up: return { x: 0, y: -1 }
    case Direction.Down: return { x: 0, y: 1 }
    case Direction.Left: return { x: -1, y: 0 }
    case Direction.Right: return { x: 1, y: 0 }
  }
}

export function vecToDirection(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) return null
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.Right : Direction.Left
  }
  return dy > 0 ? Direction.Down : Direction.Up
}

export function vec2Eq(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s }
}

// Seeded PRNG (mulberry32) for deterministic map generation
export function createRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function rngPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
