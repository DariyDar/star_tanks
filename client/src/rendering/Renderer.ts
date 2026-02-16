import { VIEWPORT_CELLS, BULLET_RANGE } from '@shared/constants.js'
import { PowerUpType, type Tank, type CTFState } from '@shared/types.js'
import type { Bullet } from '@shared/types.js'
import type { GameClient } from '../game/GameClient.js'
import { MapRenderer } from './MapRenderer.js'
import { TankRenderer, type TankColors } from './TankRenderer.js'
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
  private cellPx = 24
  private mapLoaded = false

  // Track previous bullets to detect impacts
  private prevBulletIds = new Set<string>()
  // Track previous tank positions for trails
  private prevTankPositions = new Map<string, { x: number; y: number }>()
  // Track bullets to detect new shots
  private prevBullets: Map<string, Bullet> = new Map()
  // Track stars to detect collection
  private prevActiveStars = new Set<string>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    // Cell size based on shorter dimension so we see VIEWPORT_CELLS in that axis
    this.cellPx = Math.min(window.innerWidth, window.innerHeight) / VIEWPORT_CELLS
  }

  setCustomTankColors(colors: TankColors | null): void {
    this.tankRenderer.customColors = colors
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

    // Update camera viewport for non-square canvas
    camera.setViewport(this.canvas.width, this.canvas.height, cellPx)

    // Detect bullet impacts (bullets that disappeared since last frame)
    this.detectBulletImpacts(state.bullets)

    // Detect new bullets (muzzle flashes for all tanks)
    for (const bullet of state.bullets) {
      if (!this.prevBullets.has(bullet.id)) {
        // New bullet - add muzzle flash at the owner tank's gun position
        const ownerTank = state.tanks.find(t => t.id === bullet.ownerId)
        if (ownerTank && ownerTank.isAlive) {
          const barrelLength = ownerTank.tankRadius * 1.2
          const flashX = ownerTank.position.x + Math.sin(ownerTank.turretAngle) * barrelLength
          const flashY = ownerTank.position.y - Math.cos(ownerTank.turretAngle) * barrelLength
          this.effects.addMuzzleFlash(flashX, flashY, ownerTank.turretAngle)
        }
      }
    }
    this.prevBullets = new Map(state.bullets.map(b => [b.id, b]))

    // Update screen shake + recoil
    this.effects.updateShake()

    // Apply screen shake offset
    ctx.save()
    ctx.translate(this.effects.shakeOffsetX, this.effects.shakeOffsetY)

    // Map
    this.mapRenderer.render(ctx, camera, cellPx)

    // Zone overlay
    this.zoneRenderer.render(ctx, state.zone, camera, cellPx)

    // CTF bases and flags
    if (state.ctf) {
      this.renderCTF(ctx, state.ctf, camera, cellPx)
    }

    // Tank trails (drawn first, under everything)
    this.effects.renderTankTrails(ctx, camera, cellPx)

    // Detect star collections (active → inactive = collected)
    const currentActiveStars = new Set<string>()
    for (const star of state.stars) {
      if (star.active) {
        currentActiveStars.add(star.id)
        if (!this.prevActiveStars.has(star.id) && this.prevActiveStars.size > 0) {
          // Star appeared (respawned) — no effect needed
        }
      } else if (this.prevActiveStars.has(star.id)) {
        // Star was active, now inactive = collected
        this.effects.addStarCollect(star.position.x, star.position.y)
      }
    }
    this.prevActiveStars = currentActiveStars

    // Stars
    this.renderStars(ctx, state, camera, cellPx)

    // Power-ups
    this.renderPowerUps(ctx, state, camera, cellPx)

    // Portals
    this.effects.renderPortals(ctx, state.portals, camera, cellPx)

    // Bullets
    this.bulletRenderer.render(ctx, state.bullets, camera, cellPx)

    // Bullet impacts, brick debris, and smoke
    this.effects.renderBulletImpacts(ctx, camera, cellPx)
    this.effects.renderBrickDebris(ctx, camera, cellPx)
    this.effects.renderSmokeParticles(ctx, camera, cellPx)

    // Star collection effects
    this.effects.renderStarCollects(ctx, camera, cellPx)

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
    // Add tank trails for moving tanks
    for (const tank of displayTanks) {
      if (!tank.isAlive) continue

      const prevPos = this.prevTankPositions.get(tank.id)
      if (prevPos) {
        const dx = tank.position.x - prevPos.x
        const dy = tank.position.y - prevPos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Tank is moving if it moved more than a small threshold
        if (dist > 0.02) {
          this.effects.addTankTrail(tank.position.x, tank.position.y, tank.hullAngle)
        }
      }

      this.prevTankPositions.set(tank.id, { x: tank.position.x, y: tank.position.y })
    }

    // Bush stealth: hide enemy tanks in bushes unless very close
    const playerTank = state.tanks.find(t => t.id === playerId)
    const visibleTanks = displayTanks.filter(tank => {
      // Always show player's own tank
      if (tank.id === playerId) return true

      // If tank is not in bush, show it
      if (!tank.inBush) return true

      // Tank is in bush - only show if player is very close (within 3 units)
      if (playerTank) {
        const dx = tank.position.x - playerTank.position.x
        const dy = tank.position.y - playerTank.position.y
        const distSq = dx * dx + dy * dy
        const STEALTH_REVEAL_DISTANCE = 3 // Reveal hidden tanks within 3 units
        return distSq <= STEALTH_REVEAL_DISTANCE * STEALTH_REVEAL_DISTANCE
      }

      // If no player tank, hide all bushed tanks
      return false
    })

    // Optical sight laser lines (under tanks, above map)
    this.renderOpticalSights(ctx, visibleTanks, camera, cellPx)

    this.tankRenderer.render(ctx, visibleTanks, camera, cellPx, playerId)

    // Bushes on TOP of tanks (so tanks can hide in them)
    this.mapRenderer.renderBushes(ctx, camera, cellPx)

    // Muzzle flashes (on top of tanks)
    this.effects.renderMuzzleFlashes(ctx, camera, cellPx)

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
        this.effects.renderPortalArrow(ctx, myPos, nearest.position, this.canvas.width, this.canvas.height)
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
    const t = Date.now() / 1000

    for (const star of state.stars) {
      if (!star.active) continue
      if (!camera.isVisible(star.position.x, star.position.y)) continue

      const { sx, sy } = camera.worldToScreen(star.position.x, star.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2
      const r = cellPx * 0.32

      // Shadow under star
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.beginPath()
      ctx.arc(cx + 2, cy + 2, r * 0.8, 0, Math.PI * 2)
      ctx.fill()

      // Glow effect
      ctx.shadowColor = '#FFD700'
      ctx.shadowBlur = 15
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Rotate star slowly
      const rotation = t * 0.5

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotation)

      // Star with gradient (3D effect)
      const starGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      starGradient.addColorStop(0, '#FFFFD0')
      starGradient.addColorStop(0.4, '#FFD700')
      starGradient.addColorStop(0.7, '#FFB700')
      starGradient.addColorStop(1, '#CC9900')

      ctx.fillStyle = starGradient
      ctx.shadowBlur = 8

      // Draw 5-pointed star
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const outerR = r
        const innerR = r * 0.4
        const outerAngle = angle
        const innerAngle = angle + Math.PI / 5

        if (i === 0) {
          ctx.moveTo(outerR * Math.cos(outerAngle), outerR * Math.sin(outerAngle))
        } else {
          ctx.lineTo(outerR * Math.cos(outerAngle), outerR * Math.sin(outerAngle))
        }
        ctx.lineTo(innerR * Math.cos(innerAngle), innerR * Math.sin(innerAngle))
      }
      ctx.closePath()
      ctx.fill()

      // Inner bright core
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Sparkle effect
      const sparkle = Math.sin(t * 3 + star.position.x + star.position.y) * 0.5 + 0.5
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkle})`
      ctx.shadowBlur = 2
      ctx.beginPath()
      ctx.arc(-r * 0.15, -r * 0.15, r * 0.15, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
      ctx.shadowBlur = 0
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
      shield: '#4488FF',
      magnet: '#FFD700',
      heal: '#FF66FF',
      opticalSight: '#FF2222',
      rocket: '#FF6600'
    }

    for (const pu of state.powerUps) {
      if (!camera.isVisible(pu.position.x, pu.position.y)) continue

      const { sx, sy } = camera.worldToScreen(pu.position.x, pu.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2
      const r = cellPx * 0.4 * pulse

      // Background circle with glow
      ctx.shadowBlur = 10
      ctx.shadowColor = colors[pu.type] ?? '#FFF'
      ctx.fillStyle = colors[pu.type] ?? '#FFF'
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1.0
      ctx.shadowBlur = 0

      // Icon for each type
      ctx.strokeStyle = colors[pu.type] ?? '#FFF'
      ctx.fillStyle = colors[pu.type] ?? '#FFF'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const iconSize = r * 0.6

      switch (pu.type) {
        case 'rapidFire':
          // Three bullets icon
          for (let i = -1; i <= 1; i++) {
            ctx.fillRect(cx + i * iconSize * 0.4 - iconSize * 0.1, cy - iconSize * 0.6, iconSize * 0.2, iconSize * 1.2)
          }
          break

        case 'speed':
          // Lightning bolt
          ctx.beginPath()
          ctx.moveTo(cx + iconSize * 0.2, cy - iconSize * 0.8)
          ctx.lineTo(cx - iconSize * 0.3, cy)
          ctx.lineTo(cx + iconSize * 0.1, cy)
          ctx.lineTo(cx - iconSize * 0.2, cy + iconSize * 0.8)
          ctx.lineTo(cx + iconSize * 0.3, cy - 0.2)
          ctx.lineTo(cx - iconSize * 0.1, cy - 0.2)
          ctx.closePath()
          ctx.fill()
          break

        case 'shield':
          // Shield shape
          ctx.beginPath()
          ctx.moveTo(cx, cy - iconSize * 0.8)
          ctx.lineTo(cx + iconSize * 0.6, cy - iconSize * 0.4)
          ctx.lineTo(cx + iconSize * 0.6, cy + iconSize * 0.2)
          ctx.quadraticCurveTo(cx + iconSize * 0.6, cy + iconSize * 0.7, cx, cy + iconSize * 0.9)
          ctx.quadraticCurveTo(cx - iconSize * 0.6, cy + iconSize * 0.7, cx - iconSize * 0.6, cy + iconSize * 0.2)
          ctx.lineTo(cx - iconSize * 0.6, cy - iconSize * 0.4)
          ctx.closePath()
          ctx.fill()
          // Cross on shield
          ctx.strokeStyle = '#FFF'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(cx, cy - iconSize * 0.4)
          ctx.lineTo(cx, cy + iconSize * 0.4)
          ctx.moveTo(cx - iconSize * 0.3, cy)
          ctx.lineTo(cx + iconSize * 0.3, cy)
          ctx.stroke()
          break

        case 'magnet':
          // Horseshoe magnet
          ctx.beginPath()
          ctx.arc(cx, cy, iconSize * 0.6, Math.PI, 0, false)
          ctx.lineWidth = iconSize * 0.3
          ctx.stroke()
          // Magnet poles (N/S)
          ctx.fillStyle = '#FF4444'
          ctx.fillRect(cx - iconSize * 0.65, cy - iconSize * 0.15, iconSize * 0.25, iconSize * 0.5)
          ctx.fillStyle = '#4444FF'
          ctx.fillRect(cx + iconSize * 0.4, cy - iconSize * 0.15, iconSize * 0.25, iconSize * 0.5)
          break

        case 'heal': {
          // Medical cross
          ctx.fillStyle = colors[pu.type] ?? '#FFF'
          const crossW = iconSize * 0.3
          const crossL = iconSize * 0.9
          ctx.fillRect(cx - crossW / 2, cy - crossL / 2, crossW, crossL)
          ctx.fillRect(cx - crossL / 2, cy - crossW / 2, crossL, crossW)
          break
        }

        case 'opticalSight':
          // Crosshair / scope icon
          ctx.strokeStyle = '#FF2222'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, cy, iconSize * 0.5, 0, Math.PI * 2)
          ctx.stroke()
          // Cross lines
          ctx.beginPath()
          ctx.moveTo(cx - iconSize * 0.8, cy)
          ctx.lineTo(cx + iconSize * 0.8, cy)
          ctx.moveTo(cx, cy - iconSize * 0.8)
          ctx.lineTo(cx, cy + iconSize * 0.8)
          ctx.stroke()
          // Center dot
          ctx.fillStyle = '#FF2222'
          ctx.beginPath()
          ctx.arc(cx, cy, iconSize * 0.1, 0, Math.PI * 2)
          ctx.fill()
          break

        case 'rocket':
          // Rocket icon
          ctx.fillStyle = '#FF6600'
          ctx.save()
          ctx.translate(cx, cy)
          // Rocket body
          ctx.beginPath()
          ctx.ellipse(0, 0, iconSize * 0.25, iconSize * 0.7, 0, 0, Math.PI * 2)
          ctx.fill()
          // Nose cone
          ctx.fillStyle = '#FF4400'
          ctx.beginPath()
          ctx.moveTo(-iconSize * 0.2, -iconSize * 0.6)
          ctx.lineTo(0, -iconSize * 0.95)
          ctx.lineTo(iconSize * 0.2, -iconSize * 0.6)
          ctx.closePath()
          ctx.fill()
          // Fins
          ctx.fillStyle = '#CC3300'
          ctx.beginPath()
          ctx.moveTo(-iconSize * 0.2, iconSize * 0.5)
          ctx.lineTo(-iconSize * 0.5, iconSize * 0.8)
          ctx.lineTo(-iconSize * 0.15, iconSize * 0.3)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(iconSize * 0.2, iconSize * 0.5)
          ctx.lineTo(iconSize * 0.5, iconSize * 0.8)
          ctx.lineTo(iconSize * 0.15, iconSize * 0.3)
          ctx.closePath()
          ctx.fill()
          // Exhaust
          ctx.fillStyle = 'rgba(255,200,50,0.7)'
          ctx.beginPath()
          ctx.arc(0, iconSize * 0.7, iconSize * 0.15, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          break
      }

      // White outline circle
      ctx.strokeStyle = '#FFF'
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1.0
    }
  }

  private renderOpticalSights(
    ctx: CanvasRenderingContext2D,
    tanks: Tank[],
    camera: import('../game/Camera.js').Camera,
    cellPx: number
  ): void {
    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (tank.activePowerUp !== PowerUpType.OpticalSight) continue
      if (!camera.isVisible(tank.position.x, tank.position.y)) continue

      const { sx, sy } = camera.worldToScreen(tank.position.x, tank.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      // Laser line from barrel tip to bullet range
      const barrelLength = tank.tankRadius * 1.2 * cellPx
      const laserLength = BULLET_RANGE * cellPx

      const startX = cx + Math.sin(tank.turretAngle) * barrelLength
      const startY = cy - Math.cos(tank.turretAngle) * barrelLength
      const endX = cx + Math.sin(tank.turretAngle) * laserLength
      const endY = cy - Math.cos(tank.turretAngle) * laserLength

      // Outer glow
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.15)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      // Main laser line (thin, bright red)
      ctx.strokeStyle = 'rgba(255, 30, 30, 0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      // Dot at end
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
      ctx.beginPath()
      ctx.arc(endX, endY, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
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

  private renderCTF(ctx: CanvasRenderingContext2D, ctf: CTFState, camera: { x: number; y: number }, cellPx: number): void {
    // Draw base territories with dashed rectangles
    ctx.save()
    ctx.setLineDash([cellPx * 0.3, cellPx * 0.2])
    ctx.lineWidth = 2

    // Base A (blue)
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.6)'
    ctx.strokeRect(
      (ctf.baseA.x - camera.x) * cellPx,
      (ctf.baseA.y - camera.y) * cellPx,
      ctf.baseA.w * cellPx,
      ctf.baseA.h * cellPx
    )
    ctx.fillStyle = 'rgba(68, 136, 255, 0.05)'
    ctx.fillRect(
      (ctf.baseA.x - camera.x) * cellPx,
      (ctf.baseA.y - camera.y) * cellPx,
      ctf.baseA.w * cellPx,
      ctf.baseA.h * cellPx
    )

    // Base B (red)
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)'
    ctx.strokeRect(
      (ctf.baseB.x - camera.x) * cellPx,
      (ctf.baseB.y - camera.y) * cellPx,
      ctf.baseB.w * cellPx,
      ctf.baseB.h * cellPx
    )
    ctx.fillStyle = 'rgba(255, 68, 68, 0.05)'
    ctx.fillRect(
      (ctf.baseB.x - camera.x) * cellPx,
      (ctf.baseB.y - camera.y) * cellPx,
      ctf.baseB.w * cellPx,
      ctf.baseB.h * cellPx
    )

    ctx.setLineDash([])
    ctx.restore()

    // Draw flags (only if not carried — carrier's tank shows it)
    if (!ctf.flagACarrier) {
      this.renderFlag(ctx, ctf.flagA, camera, cellPx, '#4488FF', ctf.flagADropped)
    }
    if (!ctf.flagBCarrier) {
      this.renderFlag(ctx, ctf.flagB, camera, cellPx, '#FF4444', ctf.flagBDropped)
    }
  }

  private renderFlag(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, camera: { x: number; y: number }, cellPx: number, color: string, dropped: boolean): void {
    const sx = (pos.x - camera.x) * cellPx
    const sy = (pos.y - camera.y) * cellPx
    const flagSize = cellPx * 0.8

    // Pole
    ctx.strokeStyle = '#AAA'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx, sy + flagSize * 0.5)
    ctx.lineTo(sx, sy - flagSize * 0.5)
    ctx.stroke()

    // Flag triangle
    ctx.fillStyle = color
    ctx.globalAlpha = dropped ? 0.7 : 1
    ctx.beginPath()
    ctx.moveTo(sx, sy - flagSize * 0.5)
    ctx.lineTo(sx + flagSize * 0.6, sy - flagSize * 0.25)
    ctx.lineTo(sx, sy)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1

    // Pulse glow if dropped
    if (dropped) {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 300)
      ctx.fillStyle = color
      ctx.globalAlpha = pulse
      ctx.beginPath()
      ctx.arc(sx, sy, flagSize * 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  get currentCellPx(): number {
    return this.cellPx
  }

  setShopOpen(open: boolean): void {
    this.hudRenderer.shopOpen = open
  }

  setStuckHint(isStuck: boolean, cooldownMs: number): void {
    this.hudRenderer.showStuckHint = isStuck
    this.hudRenderer.unstickCooldownMs = cooldownMs
  }
}
