import { Direction, type Tank } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'

export class TankRenderer {
  render(ctx: CanvasRenderingContext2D, tanks: Tank[], camera: Camera, cellPx: number, myId: string): void {
    for (const tank of tanks) {
      if (!tank.isAlive) continue
      if (!camera.isVisible(tank.position.x, tank.position.y)) continue

      const { sx, sy } = camera.worldToScreen(tank.position.x, tank.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(directionToAngle(tank.direction))

      const s = cellPx * 0.45

      // Treads
      ctx.fillStyle = shadeColor(tank.color, -60)
      ctx.fillRect(-s, -s, s * 0.35, s * 2)
      ctx.fillRect(s * 0.65, -s, s * 0.35, s * 2)

      // Tread marks
      ctx.strokeStyle = shadeColor(tank.color, -80)
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const ty = -s + (i + 0.5) * (s * 2) / 4
        ctx.beginPath()
        ctx.moveTo(-s, ty)
        ctx.lineTo(-s + s * 0.35, ty)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(s * 0.65, ty)
        ctx.lineTo(s, ty)
        ctx.stroke()
      }

      // Hull
      ctx.fillStyle = tank.color
      ctx.fillRect(-s * 0.65, -s * 0.8, s * 1.3, s * 1.6)

      // Turret
      ctx.fillStyle = shadeColor(tank.color, -30)
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2)
      ctx.fill()

      // Gun barrel
      ctx.fillStyle = shadeColor(tank.color, -50)
      ctx.fillRect(-s * 0.08, -s * 1.1, s * 0.16, s * 0.7)

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

function directionToAngle(dir: Direction): number {
  switch (dir) {
    case Direction.Up: return 0
    case Direction.Right: return Math.PI / 2
    case Direction.Down: return Math.PI
    case Direction.Left: return -Math.PI / 2
  }
}

function shadeColor(color: string, amount: number): string {
  const num = parseInt(color.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount))
  return `rgb(${r},${g},${b})`
}
