import type { Tank } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

const HULL_ROTATION_SPEED = 12 // radians per second
const TURRET_ROTATION_SPEED = 16

export class TankRenderer {
  private hullAngles = new Map<string, number>()
  private turretAngles = new Map<string, number>()
  private lastTime = performance.now()

  render(ctx: CanvasRenderingContext2D, tanks: Tank[], camera: Camera, cellPx: number, myId: string): void {
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (!camera.isVisible(tank.position.x, tank.position.y)) continue

      const { sx, sy } = camera.worldToScreen(tank.position.x, tank.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      // Smooth hull rotation
      const hullAngle = this.smoothAngle(this.hullAngles, tank.id, tank.hullAngle, HULL_ROTATION_SPEED, dt)
      // Smooth turret rotation
      const turretAngle = this.smoothAngle(this.turretAngles, tank.id, tank.turretAngle, TURRET_ROTATION_SPEED, dt)

      // Scale size based on tankRadius (grows with stars)
      const s = cellPx * tank.tankRadius

      // Shadow under tank (2.5D effect)
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(cx + s * 0.15, cy + s * 0.15, s * 1.1, s * 0.9, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1.0
      ctx.restore()

      // 1. Draw hull (treads + body) with 3D effect
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(hullAngle)

      // Treads with depth and gradient
      const treadGradient = ctx.createLinearGradient(-s, -s, -s, s)
      treadGradient.addColorStop(0, shadeColor(tank.color, -80))
      treadGradient.addColorStop(0.3, shadeColor(tank.color, -60))
      treadGradient.addColorStop(0.7, shadeColor(tank.color, -70))
      treadGradient.addColorStop(1, shadeColor(tank.color, -90))

      // Left tread with 3D depth
      ctx.fillStyle = treadGradient
      ctx.fillRect(-s * 1.05, -s, s * 0.35, s * 2)
      // Inner shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(-s * 1.05, -s, s * 0.1, s * 2)

      // Right tread
      ctx.fillStyle = treadGradient
      ctx.fillRect(s * 0.7, -s, s * 0.35, s * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(s * 0.7, -s, s * 0.1, s * 2)

      // Tread details (rivets and tracks)
      ctx.fillStyle = shadeColor(tank.color, -100)
      for (let i = 0; i < 6; i++) {
        const ty = -s + (i / 5) * (s * 2)
        // Left tread rivets
        ctx.beginPath()
        ctx.arc(-s * 0.87, ty, s * 0.05, 0, Math.PI * 2)
        ctx.fill()
        // Right tread rivets
        ctx.beginPath()
        ctx.arc(s * 0.87, ty, s * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }

      // Hull body with metallic gradient
      const hullGradient = ctx.createLinearGradient(-s * 0.65, -s * 0.8, s * 0.65, s * 0.8)
      hullGradient.addColorStop(0, shadeColor(tank.color, -20))
      hullGradient.addColorStop(0.3, tank.color)
      hullGradient.addColorStop(0.5, shadeColor(tank.color, 20))
      hullGradient.addColorStop(0.7, tank.color)
      hullGradient.addColorStop(1, shadeColor(tank.color, -10))

      ctx.fillStyle = hullGradient
      ctx.fillRect(-s * 0.65, -s * 0.8, s * 1.3, s * 1.6)

      // Hull edge highlight (3D effect)
      ctx.strokeStyle = shadeColor(tank.color, 40)
      ctx.lineWidth = 2
      ctx.strokeRect(-s * 0.65, -s * 0.8, s * 1.3, s * 1.6)

      // Hull panels/details
      ctx.strokeStyle = shadeColor(tank.color, -30)
      ctx.lineWidth = 1
      ctx.strokeRect(-s * 0.5, -s * 0.65, s, s * 1.3)

      ctx.restore()

      // 2. Draw turret (separate rotation) with 3D effect
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(turretAngle)

      // Turret base shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.arc(0, s * 0.05, s * 0.42, 0, Math.PI * 2)
      ctx.fill()

      // Turret dome with radial gradient (3D sphere effect)
      const turretGradient = ctx.createRadialGradient(-s * 0.15, -s * 0.15, 0, 0, 0, s * 0.4)
      turretGradient.addColorStop(0, shadeColor(tank.color, 30))
      turretGradient.addColorStop(0.5, shadeColor(tank.color, -10))
      turretGradient.addColorStop(1, shadeColor(tank.color, -40))

      ctx.fillStyle = turretGradient
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2)
      ctx.fill()

      // Turret highlight (metallic shine)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.beginPath()
      ctx.arc(-s * 0.1, -s * 0.1, s * 0.15, 0, Math.PI * 2)
      ctx.fill()

      // Gun barrel with 3D depth
      const barrelGradient = ctx.createLinearGradient(-s * 0.12, 0, s * 0.12, 0)
      barrelGradient.addColorStop(0, shadeColor(tank.color, -80))
      barrelGradient.addColorStop(0.5, shadeColor(tank.color, -50))
      barrelGradient.addColorStop(1, shadeColor(tank.color, -70))

      ctx.fillStyle = barrelGradient
      ctx.fillRect(-s * 0.1, -s * 1.2, s * 0.2, s * 0.8)

      // Barrel end (muzzle)
      ctx.fillStyle = '#000'
      ctx.fillRect(-s * 0.1, -s * 1.2, s * 0.2, s * 0.1)

      // Barrel highlight
      ctx.fillStyle = shadeColor(tank.color, -30)
      ctx.fillRect(-s * 0.08, -s * 1.15, s * 0.03, s * 0.65)

      ctx.restore()

      // HP bar
      this.renderHPBar(ctx, sx, sy, cellPx, tank)

      // Name
      if (tank.id !== myId) {
        ctx.fillStyle = '#FFF'
        ctx.font = `${Math.max(8, cellPx / 3)}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(tank.name, cx, sy - cellPx * 0.15)
      }

      // Star count badge
      if (tank.stars > 0) {
        ctx.fillStyle = '#FFD700'
        ctx.font = `bold ${Math.max(7, cellPx / 4)}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`${tank.stars}`, cx, sy + cellPx + 2)
      }
    }
  }

  private smoothAngle(angleMap: Map<string, number>, id: string, targetAngle: number, speed: number, dt: number): number {
    let current = angleMap.get(id) ?? targetAngle

    let diff = targetAngle - current
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    if (Math.abs(diff) < 0.01) {
      current = targetAngle
    } else {
      current += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt)
    }

    angleMap.set(id, current)
    return current
  }

  private renderHPBar(
    ctx: CanvasRenderingContext2D, sx: number, sy: number,
    cellPx: number, tank: Tank
  ): void {
    const barW = cellPx * 0.8
    const barH = 3
    const barX = sx + (cellPx - barW) / 2
    const barY = sy - 6

    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barW, barH)

    const ratio = tank.hp / tank.maxHp
    const color = ratio > 0.5 ? '#44CC44' : ratio > 0.25 ? '#FFAA00' : '#FF4444'
    ctx.fillStyle = color
    ctx.fillRect(barX, barY, barW * ratio, barH)
  }
}

function shadeColor(color: string, amount: number): string {
  const num = parseInt(color.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount))
  return `rgb(${r},${g},${b})`
}
