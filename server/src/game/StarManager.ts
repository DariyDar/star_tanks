import type { Star, Tank, Vec2 } from '@tank-br/shared/types.js'
import { STAR_RESPAWN_TIME, getTankRadius } from '@tank-br/shared/constants.js'

let starIdCounter = 0

export class StarManager {
  private stars: Star[] = []

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
        if (tank.isBot) continue  // Боты не собирают звёзды

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
          // Update tank size based on new star count
          tank.tankRadius = getTankRadius(tank.stars)
          break
        }
      }
    }
  }

  dropStarsAtPosition(pos: Vec2, count: number): void {
    // Scatter dropped stars around the death position
    let placed = 0
    for (const star of this.stars) {
      if (placed >= count) break
      if (!star.active) {
        star.position = {
          x: pos.x + (placed % 5) - 2,
          y: pos.y + Math.floor(placed / 5) - 2
        }
        star.active = true
        star.respawnAt = 0
        placed++
      }
    }
  }

  addStar(star: Star): void {
    this.stars.push(star)
  }

  getStars(): Star[] {
    return this.stars
  }
}
