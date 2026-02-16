import type { Star, Tank, Vec2 } from '@tank-br/shared/types.js'
import { STAR_RESPAWN_TIME, getTankRadius } from '@tank-br/shared/constants.js'
import { SpatialGrid, isWalkableCell } from '@tank-br/shared/collision.js'

let starIdCounter = 0

export class StarManager {
  private stars: Star[] = []
  private grid: SpatialGrid | null = null
  private mapWidth = 200
  private mapHeight = 200

  setGrid(grid: SpatialGrid, mapWidth: number, mapHeight: number): void {
    this.grid = grid
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }

  constructor(positions: Vec2[]) {
    for (const pos of positions) {
      this.stars.push({
        id: `star_${starIdCounter++}`,
        position: { x: pos.x, y: pos.y },
        active: true,
        respawnAt: 0
      })
    }
  }

  update(tanks: Tank[], now: number): void {
    for (const star of this.stars) {
      // Respawn inactive stars
      if (!star.active && now >= star.respawnAt) {
        star.active = true
      }

      // Check collection
      if (!star.active) continue

      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (tank.isBot) continue  // Боты не собирают звёзды (включая босса)

        // Радиус притяжения (по умолчанию 1, может быть увеличен бонусом)
        const magnetRadius = (tank as any).magnetRadius ?? 1
        const dx = tank.position.x - star.position.x
        const dy = tank.position.y - star.position.y
        const distSq = dx * dx + dy * dy

        // Проверка попадания в радиус притяжения
        if (distSq <= magnetRadius * magnetRadius) {
          star.active = false
          star.respawnAt = now + STAR_RESPAWN_TIME
          tank.stars += 1
          // Update tank size based on new star count (but not for boss)
          if (tank.id !== 'boss_1') {
            tank.tankRadius = getTankRadius(tank.stars)
          }
          break
        }
      }
    }
  }

  private findWalkablePosition(center: Vec2, angle: number, baseDist: number): Vec2 {
    // Try the intended position first
    for (let attempt = 0; attempt < 5; attempt++) {
      const dist = baseDist + attempt * 0.5
      const x = center.x + Math.cos(angle) * dist
      const y = center.y + Math.sin(angle) * dist
      const cellX = Math.floor(x)
      const cellY = Math.floor(y)
      if (!this.grid || isWalkableCell(cellX, cellY, this.grid, this.mapWidth, this.mapHeight)) {
        return { x, y }
      }
    }
    // Fallback: return center position
    return { x: center.x, y: center.y }
  }

  dropStarsAtPosition(pos: Vec2, count: number): void {
    // Scatter dropped stars in a circle around the death position
    let placed = 0
    for (const star of this.stars) {
      if (placed >= count) break
      if (!star.active) {
        const angle = (placed / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
        const dist = 1.0 + Math.random() * 1.5
        star.position = this.findWalkablePosition(pos, angle, dist)
        star.active = true
        star.respawnAt = 0
        placed++
      }
    }

    // If not enough inactive stars, create new ones
    while (placed < count) {
      const angle = (placed / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dist = 1.0 + Math.random() * 1.5
      this.stars.push({
        id: `star_${starIdCounter++}`,
        position: this.findWalkablePosition(pos, angle, dist),
        active: true,
        respawnAt: 0
      })
      placed++
    }
  }

  addStar(star: Star): void {
    this.stars.push(star)
  }

  getStars(): Star[] {
    return this.stars
  }
}
