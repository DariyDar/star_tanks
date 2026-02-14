import type { Star, Tank, Vec2 } from '../../../shared/src/types.js'
import { STAR_RESPAWN_TIME } from '../../../shared/src/constants.js'

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
        if (
          Math.round(tank.position.x) === star.position.x &&
          Math.round(tank.position.y) === star.position.y
        ) {
          star.active = false
          star.respawnAt = now + STAR_RESPAWN_TIME
          tank.stars += 1
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

  getStars(): Star[] {
    return this.stars
  }
}
