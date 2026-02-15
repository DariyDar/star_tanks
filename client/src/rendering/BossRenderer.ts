import type { Boss } from '@shared/types.js'
import type { Camera } from '../game/Camera.js'
import { BossAttackType } from '@shared/types.js'

export class BossRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    boss: Boss | null,
    camera: Camera,
    cellPx: number
  ): void {
    if (!boss || !boss.isAlive) return

    const { sx, sy } = camera.worldToScreen(boss.position.x, boss.position.y, cellPx)

    // Boss is 3x larger than normal tank
    const bossRadiusPx = 1.35 * cellPx

    // HP bar (show above boss)
    const barWidth = bossRadiusPx * 2
    const barHeight = 8
    const barX = sx + cellPx / 2 - barWidth / 2
    const barY = sy - barHeight - 10

    // Background (red)
    ctx.fillStyle = '#600'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // HP (green)
    const hpPercent = boss.hp / boss.maxHp
    ctx.fillStyle = hpPercent > 0.3 ? '#0f0' : '#ff0'
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight)

    // Border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(barX, barY, barWidth, barHeight)

    // HP text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${boss.hp} / ${boss.maxHp}`, barX + barWidth / 2, barY - 4)

    // Boss body (dark red circle)
    ctx.fillStyle = '#8B0000'
    ctx.beginPath()
    ctx.arc(sx + cellPx / 2, sy + cellPx / 2, bossRadiusPx, 0, Math.PI * 2)
    ctx.fill()

    // Boss outline (gold)
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 3
    ctx.stroke()

    // Boss symbol (skull or star)
    ctx.save()
    ctx.translate(sx + cellPx / 2, sy + cellPx / 2)
    ctx.fillStyle = '#FFD700'
    ctx.font = `bold ${bossRadiusPx * 1.2}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('★', 0, 0)
    ctx.restore()

    // Rotating laser beam (if active)
    if (boss.currentAttack === BossAttackType.RotatingLaser && boss.laserAngle !== undefined) {
      ctx.save()
      ctx.translate(sx + cellPx / 2, sy + cellPx / 2)
      ctx.rotate(boss.laserAngle)

      // Laser beam
      const laserLength = 30 * cellPx
      const gradient = ctx.createLinearGradient(0, 0, laserLength, 0)
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)')
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)')
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')

      ctx.strokeStyle = gradient
      ctx.lineWidth = 12
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(laserLength, 0)
      ctx.stroke()

      // Laser glow
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'
      ctx.lineWidth = 20
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(laserLength, 0)
      ctx.stroke()

      ctx.restore()
    }

    // Phase indicator (small circles showing HP thresholds)
    const phaseCount = 10
    const phaseRadius = 4
    const phaseSpacing = 10
    const phaseStartX = sx + cellPx / 2 - ((phaseCount - 1) * phaseSpacing) / 2
    const phaseY = barY - 15

    for (let i = 0; i < phaseCount; i++) {
      const phaseFilled = boss.phase <= i
      ctx.fillStyle = phaseFilled ? '#666' : '#FFD700'
      ctx.beginPath()
      ctx.arc(phaseStartX + i * phaseSpacing, phaseY, phaseRadius, 0, Math.PI * 2)
      ctx.fill()

      if (!phaseFilled) {
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }
}
