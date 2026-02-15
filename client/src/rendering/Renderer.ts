import { VIEWPORT_CELLS, CELL_SIZE } from '@shared/constants.js'
import type { Bullet } from '@shared/types.js'
import type { GameClient } from '../game/GameClient.js'
import { MapRenderer } from './MapRenderer.js'
import { TankRenderer } from './TankRenderer.js'
import { BulletRenderer } from './BulletRenderer.js'
import { HudRenderer } from './HudRenderer.js'
import { MinimapRenderer } from './MinimapRenderer.js'
import { ZoneRenderer } from './ZoneRenderer.js'
import { EffectsRenderer } from './EffectsRenderer.js'

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private mapRenderer = new MapRenderer()
  private tankRenderer = new TankRenderer()
  private bulletRenderer = new BulletRenderer()
  private hudRenderer = new HudRenderer()
  private minimapRenderer = new MinimapRenderer()
  private zoneRenderer = new ZoneRenderer()
  readonly effects = new EffectsRenderer()
  private cellPx = CELL_SIZE
  private mapLoaded = false

  // Track previous bullets to detect impacts
  private prevBulletIds = new Set<string>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize(): void {
    const size = Math.min(window.innerWidth, window.innerHeight)
    this.canvas.width = size
    this.canvas.height = size
    this.cellPx = size / VIEWPORT_CELLS
  }

  loadMap(client: GameClient): void {
    this.mapRenderer.loadObstacles(client.obstacles)
    this.mapLoaded = true
  }

  render(client: GameClient): void {
    const { ctx, cellPx } = this
    const { state, camera, playerId, mapWidth, mapHeight } = client

    if (!state || !this.mapLoaded) {
      this.renderLoading()
      return
    }

    // Detect bullet impacts (bullets that disappeared since last frame)
    this.detectBulletImpacts(state.bullets)

    // Update screen shake + recoil
    this.effects.updateShake()

    // Apply screen shake offset
    ctx.save()
    ctx.translate(this.effects.shakeOffsetX, this.effects.shakeOffsetY)

    // Map
    this.mapRenderer.render(ctx, camera, cellPx)

    // Zone overlay
    this.zoneRenderer.render(ctx, state.zone, camera, cellPx)

    // Stars
    this.renderStars(ctx, state, camera, cellPx)

    // Power-ups
    this.renderPowerUps(ctx, state, camera, cellPx)

    // Portals
    this.effects.renderPortals(ctx, state.portals, camera, cellPx)

    // Bullets
    this.bulletRenderer.render(ctx, state.bullets, camera, cellPx)

    // Bullet impacts
    this.effects.renderBulletImpacts(ctx, camera, cellPx)

    // Tanks — use predicted position/angles for my tank
    const displayTanks = state.tanks.map(t => {
      if (t.id === playerId) {
        const pos = client.getMyDisplayPosition()
        if (pos) {
          // Apply recoil offset to display position
          const recoilPos = {
            x: pos.x - this.effects.recoilOffsetX,
            y: pos.y - this.effects.recoilOffsetY
          }
          return {
            ...t,
            position: recoilPos,
            hullAngle: client.getMyDisplayHullAngle(),
            turretAngle: client.getMyDisplayTurretAngle()
          }
        }
      }
      return t
    })
    this.tankRenderer.render(ctx, displayTanks, camera, cellPx, playerId)

    // Explosions
    this.effects.renderExplosions(ctx, camera, cellPx)

    // My tank indicator + portal arrow
    const myTank = client.getMyTank()
    const myPos = client.getMyDisplayPosition()
    if (myTank && myPos) {
      const { sx, sy } = camera.worldToScreen(myPos.x, myPos.y, cellPx)
      const cx = sx + cellPx / 2

      ctx.fillStyle = '#FFF'
      ctx.beginPath()
      ctx.moveTo(cx, sy - cellPx * 0.6)
      ctx.lineTo(cx - 4, sy - cellPx * 0.4)
      ctx.lineTo(cx + 4, sy - cellPx * 0.4)
      ctx.fill()

      // Arrow pointing to nearest portal
      if (state.portals.length > 0) {
        let nearest = state.portals[0]
        let minDist = Infinity
        for (const p of state.portals) {
          const dx = p.position.x - myPos.x
          const dy = p.position.y - myPos.y
          const d = dx * dx + dy * dy
          if (d < minDist) { minDist = d; nearest = p }
        }
        this.effects.renderPortalArrow(ctx, myPos, nearest.position, this.canvas.width)
      }
    }

    // Restore from shake
    ctx.restore()

    // HUD (not affected by shake)
    this.hudRenderer.render(ctx, state, myTank)

    // Minimap (not affected by shake)
    this.minimapRenderer.render(ctx, state, camera, mapWidth, mapHeight, playerId)

    // Fade effect (portal exit / death)
    this.effects.renderFade(ctx)
  }

  private detectBulletImpacts(currentBullets: Bullet[]): void {
    const currentIds = new Set(currentBullets.map(b => b.id))

    // Bullets from prev frame that are gone now = impacts
    // We stored positions in prevBullets map for this purpose
    // Since we only have IDs here, we track positions separately
    // For simplicity, just update the set for next frame
    // The actual impact detection happens through the bullet position
    // when a bullet disappears between state updates

    this.prevBulletIds = currentIds
  }

  private renderStars(
    ctx: CanvasRenderingContext2D,
    state: import('@shared/types.js').GameState,
    camera: import('../game/Camera.js').Camera,
    cellPx: number
  ): void {
    for (const star of state.stars) {
      if (!star.active) continue
      if (!camera.isVisible(star.position.x, star.position.y)) continue

      const { sx, sy } = camera.worldToScreen(star.position.x, star.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2
      const r = cellPx * 0.3

      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const method = i === 0 ? 'moveTo' : 'lineTo'
        ctx[method](cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      ctx.closePath()
      ctx.fill()
    }
  }

  private renderPowerUps(
    ctx: CanvasRenderingContext2D,
    state: import('@shared/types.js').GameState,
    camera: import('../game/Camera.js').Camera,
    cellPx: number
  ): void {
    const colors: Record<string, string> = {
      rapidFire: '#FF4444',
      speed: '#44FF44',
      shield: '#4488FF'
    }

    for (const pu of state.powerUps) {
      if (!camera.isVisible(pu.position.x, pu.position.y)) continue

      const { sx, sy } = camera.worldToScreen(pu.position.x, pu.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2
      const r = cellPx * 0.35 * pulse

      ctx.fillStyle = colors[pu.type] ?? '#FFF'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#FFF'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private renderLoading(): void {
    const { ctx, canvas } = this

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#FFD700'
    ctx.font = `bold ${canvas.width / 14}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TANK BATTLE ROYALE', canvas.width / 2, canvas.height / 3)

    ctx.fillStyle = '#888'
    ctx.font = `${canvas.width / 30}px Arial`
    ctx.fillText('Connecting...', canvas.width / 2, canvas.height / 2)
  }

  get currentCellPx(): number {
    return this.cellPx
  }
}
