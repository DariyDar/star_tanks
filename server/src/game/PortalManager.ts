import type { Portal, Tank, Vec2 } from '@tank-br/shared/types.js'
import { PORTAL_SPAWN_INTERVAL, PORTAL_LIFETIME } from '@tank-br/shared/constants.js'
import { rngInt, createRng } from '@tank-br/shared/math.js'
import { SpatialGrid, isBlockingMovement } from '@tank-br/shared/collision.js'

let portalIdCounter = 0

export class PortalManager {
  private portals: Portal[] = []
  private lastSpawnTime = 0
  private rng: () => number

  constructor(
    private readonly grid: SpatialGrid,
    private readonly mapWidth: number,
    private readonly mapHeight: number
  ) {
    this.rng = createRng(Date.now() + 999)
  }

  update(now: number, elapsed: number): Portal[] {
    // Remove expired portals
    this.portals = this.portals.filter(p => now < p.expiresAt)

    // Spawn new portal
    if (elapsed >= PORTAL_SPAWN_INTERVAL && now - this.lastSpawnTime >= PORTAL_SPAWN_INTERVAL) {
      this.spawnPortal(now)
      this.lastSpawnTime = now
    }

    return this.portals
  }

  checkPortalEntry(tanks: Tank[]): Array<{ tank: Tank; portal: Portal }> {
    const entries: Array<{ tank: Tank; portal: Portal }> = []

    for (const portal of this.portals) {
      for (const tank of tanks) {
        if (!tank.isAlive) continue
        if (
          Math.round(tank.position.x) === portal.position.x &&
          Math.round(tank.position.y) === portal.position.y
        ) {
          entries.push({ tank, portal })
        }
      }
    }

    return entries
  }

  private spawnPortal(now: number): void {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = rngInt(this.rng, 10, this.mapWidth - 10)
      const y = rngInt(this.rng, 10, this.mapHeight - 10)

      const obs = this.grid.getAt(x, y)
      if (obs && isBlockingMovement(obs.type)) continue

      this.portals.push({
        id: `portal_${portalIdCounter++}`,
        position: { x, y },
        spawnedAt: now,
        expiresAt: now + PORTAL_LIFETIME
      })
      break
    }
  }

  getPortals(): Portal[] {
    return this.portals
  }
}
