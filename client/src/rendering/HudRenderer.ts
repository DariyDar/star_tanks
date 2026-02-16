import type { GameState, Tank } from '@shared/types.js'

export class HudRenderer {
  shopOpen = false

  render(ctx: CanvasRenderingContext2D, state: GameState, myTank: Tank | undefined): void {
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const pad = 12

    if (myTank) {
      this.renderStarCounter(ctx, pad, pad, myTank)
      this.renderHpBar(ctx, pad, pad + 48, myTank)
      this.renderKillsCounter(ctx, pad, pad + 80, myTank)

      // Power-up indicator with timer
      if (myTank.activePowerUp) {
        this.renderPowerUpIndicator(ctx, pad, pad + 108, myTank, state.timestamp)
      }
    }

    // Top-right: alive players count + time
    this.renderGameInfo(ctx, w, pad, state)

    // Leaderboard
    this.renderLeaderboard(ctx, state, myTank?.id)

    // CTF scores
    if (state.ctf) {
      this.renderCTFScores(ctx, w, state.ctf)

      // Flag carrier indicator
      if (myTank?.hasFlag) {
        this.renderFlagCarrierWarning(ctx, w, h)
      }
    }

    // Shop overlay
    if (this.shopOpen && myTank) {
      this.renderShop(ctx, w, h, myTank)
    }
  }

  private renderStarCounter(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank): void {
    const panelW = 140
    const panelH = 38

    // Panel background with gradient
    const grad = ctx.createLinearGradient(x, y, x + panelW, y)
    grad.addColorStop(0, 'rgba(40, 30, 0, 0.7)')
    grad.addColorStop(1, 'rgba(40, 30, 0, 0.3)')
    ctx.fillStyle = grad
    this.roundRect(ctx, x, y, panelW, panelH, 8)
    ctx.fill()

    // Gold border
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'
    ctx.lineWidth = 1
    this.roundRect(ctx, x, y, panelW, panelH, 8)
    ctx.stroke()

    // Star icon (5-pointed star)
    const starX = x + 22
    const starY = y + panelH / 2
    const starR = 10
    this.drawStarShape(ctx, starX, starY, starR)

    // Star count text
    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'
    ctx.shadowBlur = 6
    ctx.fillText(`${tank.stars}`, x + 38, y + panelH / 2)
    ctx.shadowBlur = 0
  }

  private renderHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank): void {
    const barW = 140
    const barH = 22

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, x, y, barW, barH, 4)
    ctx.fill()

    // HP fill
    const ratio = tank.hp / tank.maxHp
    const fillW = barW * ratio

    const hpGrad = ctx.createLinearGradient(x, y, x, y + barH)
    if (ratio > 0.5) {
      hpGrad.addColorStop(0, '#66DD66')
      hpGrad.addColorStop(1, '#33AA33')
    } else if (ratio > 0.25) {
      hpGrad.addColorStop(0, '#FFCC44')
      hpGrad.addColorStop(1, '#DD9900')
    } else {
      hpGrad.addColorStop(0, '#FF5555')
      hpGrad.addColorStop(1, '#CC2222')
    }

    ctx.fillStyle = hpGrad
    if (fillW > 0) {
      this.roundRect(ctx, x, y, fillW, barH, 4)
      ctx.fill()
    }

    // HP text
    ctx.fillStyle = '#FFF'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${tank.hp} / ${tank.maxHp}`, x + barW / 2, y + barH / 2)

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    this.roundRect(ctx, x, y, barW, barH, 4)
    ctx.stroke()
  }

  private renderKillsCounter(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    this.roundRect(ctx, x, y, 140, 22, 4)
    ctx.fill()

    // Skull emoji equivalent (crosshair icon)
    ctx.fillStyle = '#FF6666'
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Kills: ${tank.kills}`, x + 10, y + 11)
  }

  private renderPowerUpIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank, timestamp: number): void {
    const powerUpColors: Record<string, string> = {
      rapidFire: '#FF4444',
      speed: '#44FF44',
      shield: '#4488FF',
      magnet: '#FFD700',
      heal: '#FF66FF',
      opticalSight: '#FF2222',
      rocket: '#FF6600'
    }
    const powerUpNames: Record<string, string> = {
      rapidFire: 'Rapid Fire',
      speed: 'Speed',
      shield: 'Shield',
      magnet: 'Magnet',
      heal: 'Heal',
      opticalSight: 'Laser Sight',
      rocket: 'Rockets'
    }
    const color = powerUpColors[tank.activePowerUp!] ?? '#FFF'
    const panelW = 160
    const panelH = 32

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, x, y, panelW, panelH, 6)
    ctx.fill()

    // Colored indicator dot
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 14, y + panelH / 2, 6, 0, Math.PI * 2)
    ctx.fill()

    // Power-up name
    ctx.fillStyle = color
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(powerUpNames[tank.activePowerUp!] ?? tank.activePowerUp, x + 26, y + panelH / 2)

    // Timer countdown
    if (tank.powerUpEndTime > 0) {
      const remaining = Math.max(0, (tank.powerUpEndTime - timestamp) / 1000)
      const remainingStr = remaining.toFixed(1) + 's'

      ctx.fillStyle = '#FFF'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(remainingStr, x + panelW - 8, y + panelH / 2)

      // Progress bar below text
      const barX = x + 4
      const barY = y + panelH - 5
      const barW = panelW - 8
      const barH = 3
      const totalDuration = 10000 // POWERUP_DURATION from constants
      const ratio = Math.min(1, Math.max(0, (tank.powerUpEndTime - timestamp) / totalDuration))

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = color
      ctx.fillRect(barX, barY, barW * ratio, barH)
    }
  }

  private renderGameInfo(ctx: CanvasRenderingContext2D, w: number, pad: number, state: GameState): void {
    const panelW = 140
    const panelH = 44

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, w - panelW - pad, pad, panelW, panelH, 8)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    this.roundRect(ctx, w - panelW - pad, pad, panelW, panelH, 8)
    ctx.stroke()

    ctx.fillStyle = '#FFF'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`Alive: ${state.playersAlive}`, w - pad - 10, pad + 6)

    const mins = Math.floor(state.timeElapsed / 60000)
    const secs = Math.floor((state.timeElapsed % 60000) / 1000)
    ctx.fillStyle = '#AAA'
    ctx.font = '13px Arial'
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, w - pad - 10, pad + 24)
  }

  private renderLeaderboard(ctx: CanvasRenderingContext2D, state: GameState, myId?: string): void {
    const w = ctx.canvas.width
    const top5 = state.leaderboard.slice(0, 5)
    const panelW = 160
    const panelH = 24 + top5.length * 18
    const panelX = w - panelW - 12
    const panelY = 66

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 6)
    ctx.fill()

    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('LEADERBOARD', panelX + 10, panelY + 5)

    ctx.font = '11px Arial'
    for (let i = 0; i < top5.length; i++) {
      const entry = top5[i]
      const y = panelY + 22 + i * 18
      const isMe = entry.id === myId

      if (isMe) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
        ctx.fillRect(panelX + 2, y - 2, panelW - 4, 16)
      }

      ctx.fillStyle = isMe ? '#FFD700' : (entry.isAlive ? '#FFF' : '#666')
      const nameStr = entry.name.length > 10 ? entry.name.slice(0, 10) + '..' : entry.name
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}. ${nameStr}`, panelX + 10, y)
      ctx.textAlign = 'right'
      ctx.fillText(`${entry.stars}`, panelX + panelW - 10, y)
      ctx.textAlign = 'left'
    }
  }

  private renderCTFScores(ctx: CanvasRenderingContext2D, w: number, ctf: import('@shared/types.js').CTFState): void {
    const panelW = 120
    const panelH = 36
    const x = (w - panelW) / 2
    const y = 10

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    this.roundRect(ctx, x, y, panelW, panelH, 8)
    ctx.fill()

    ctx.font = 'bold 16px Arial'
    ctx.textBaseline = 'middle'
    const centerY = y + panelH / 2

    // Team A score (blue)
    ctx.fillStyle = '#4488FF'
    ctx.textAlign = 'right'
    ctx.fillText(`${ctf.scoreA}`, x + panelW / 2 - 10, centerY)

    // Separator
    ctx.fillStyle = '#AAA'
    ctx.textAlign = 'center'
    ctx.fillText(':', x + panelW / 2, centerY)

    // Team B score (red)
    ctx.fillStyle = '#FF4444'
    ctx.textAlign = 'left'
    ctx.fillText(`${ctf.scoreB}`, x + panelW / 2 + 10, centerY)
  }

  private renderFlagCarrierWarning(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200)
    ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('YOU HAVE THE FLAG!', w / 2, 52)
  }

  private renderShop(ctx: CanvasRenderingContext2D, w: number, h: number, tank: Tank): void {
    const shopW = 280
    const shopH = 180
    const shopX = (w - shopW) / 2
    const shopY = (h - shopH) / 2

    // Dimmed background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, w, h)

    // Shop panel
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)'
    this.roundRect(ctx, shopX, shopY, shopW, shopH, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'
    ctx.lineWidth = 2
    this.roundRect(ctx, shopX, shopY, shopW, shopH, 12)
    ctx.stroke()

    // Title
    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('SHOP', shopX + shopW / 2, shopY + 12)

    // Stars balance
    ctx.fillStyle = '#FFF'
    ctx.font = '13px Arial'
    ctx.fillText(`Stars: ${tank.stars}`, shopX + shopW / 2, shopY + 36)

    // Items
    const items = [
      { key: '1', name: 'Speed Boost', desc: '+50% speed (10s)', cost: 2, color: '#44FF44' },
      { key: '2', name: '+2 HP', desc: 'Instant heal', cost: 2, color: '#FF66FF' },
      { key: '3', name: 'x2 Damage', desc: 'Rockets (10s)', cost: 2, color: '#FF6600' }
    ]

    const itemY = shopY + 58
    const itemH = 32
    const itemGap = 6

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const y = itemY + i * (itemH + itemGap)
      const canAfford = tank.stars >= item.cost

      // Item background
      ctx.fillStyle = canAfford ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'
      this.roundRect(ctx, shopX + 12, y, shopW - 24, itemH, 6)
      ctx.fill()

      // Key badge
      ctx.fillStyle = canAfford ? item.color : '#555'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`[${item.key}]`, shopX + 36, y + itemH / 2)

      // Name
      ctx.fillStyle = canAfford ? '#FFF' : '#666'
      ctx.font = 'bold 13px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(item.name, shopX + 58, y + itemH / 2)

      // Cost
      ctx.fillStyle = canAfford ? '#FFD700' : '#555'
      ctx.font = '12px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(`${item.cost} stars`, shopX + shopW - 20, y + itemH / 2)
    }

    // Close hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Press Esc or Ь to close', shopX + shopW / 2, shopY + shopH - 14)
  }

  private drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    // Glow
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 8

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#FFFFD0')
    grad.addColorStop(0.5, '#FFD700')
    grad.addColorStop(1, '#CC9900')
    ctx.fillStyle = grad

    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
      const innerAngle = outerAngle + Math.PI / 5
      const outerR = r
      const innerR = r * 0.4

      if (i === 0) {
        ctx.moveTo(cx + outerR * Math.cos(outerAngle), cy + outerR * Math.sin(outerAngle))
      } else {
        ctx.lineTo(cx + outerR * Math.cos(outerAngle), cy + outerR * Math.sin(outerAngle))
      }
      ctx.lineTo(cx + innerR * Math.cos(innerAngle), cy + innerR * Math.sin(innerAngle))
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}
