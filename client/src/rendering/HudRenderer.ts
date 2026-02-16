import type { GameState, Tank } from '@shared/types.js'

export class HudRenderer {
  shopOpen = false
  showStuckHint = false
  unstickCooldownMs = 0
  isMobile = false
  /** Last rendered stuck button rect for hit-testing */
  stuckButtonRect: { x: number; y: number; w: number; h: number } | null = null

  /** Scale factor for HUD elements on mobile */
  private get s(): number { return this.isMobile ? 1.4 : 1 }

  render(ctx: CanvasRenderingContext2D, state: GameState, myTank: Tank | undefined): void {
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const s = this.s
    const pad = Math.round(12 * s)

    if (myTank) {
      this.renderStarCounter(ctx, pad, pad, myTank)
      this.renderHpBar(ctx, pad, pad + Math.round(48 * s), myTank)
      this.renderKillsCounter(ctx, pad, pad + Math.round(80 * s), myTank)

      // Power-up indicator with timer
      if (myTank.activePowerUp) {
        this.renderPowerUpIndicator(ctx, pad, pad + Math.round(108 * s), myTank, state.timestamp)
      }
    }

    // Top-right: alive players count + time
    this.renderGameInfo(ctx, w, pad, state)

    // Leaderboard
    this.renderLeaderboard(ctx, state, myTank?.id)

    // CTF scores + timer
    if (state.ctf) {
      this.renderCTFScores(ctx, w, state.ctf, state.ctfTimeRemaining ?? 0)

      // Flag carrier indicator
      if (myTank?.hasFlag) {
        this.renderFlagCarrierWarning(ctx, w, h)
      }

      // Dramatic countdown (last 7 seconds)
      if (state.ctfTimeRemaining !== undefined && state.ctfTimeRemaining <= 7 && state.ctfTimeRemaining > 0) {
        this.renderCountdown(ctx, w, h, state.ctfTimeRemaining)
      }
    }

    // Stuck hint
    if (this.showStuckHint && myTank?.isAlive) {
      this.renderStuckHint(ctx, w, h)
    } else {
      this.stuckButtonRect = null
    }

    // Shop overlay
    if (this.shopOpen && myTank) {
      this.renderShop(ctx, w, h, myTank)
    }
  }

  private renderStarCounter(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank): void {
    const s = this.s
    const panelW = Math.round(140 * s)
    const panelH = Math.round(38 * s)

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
    const starX = x + Math.round(22 * s)
    const starY = y + panelH / 2
    const starR = Math.round(10 * s)
    this.drawStarShape(ctx, starX, starY, starR)

    // Star count text
    ctx.fillStyle = '#FFD700'
    ctx.font = `bold ${Math.round(20 * s)}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'
    ctx.shadowBlur = 6
    ctx.fillText(`${tank.stars}`, x + Math.round(38 * s), y + panelH / 2)
    ctx.shadowBlur = 0
  }

  private renderHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, tank: Tank): void {
    const s = this.s
    const barW = Math.round(140 * s)
    const barH = Math.round(22 * s)

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
    ctx.font = `bold ${Math.round(12 * s)}px Arial`
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
    const s = this.s
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    this.roundRect(ctx, x, y, Math.round(140 * s), Math.round(22 * s), 4)
    ctx.fill()

    ctx.fillStyle = '#FF6666'
    ctx.font = `bold ${Math.round(13 * s)}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Kills: ${tank.kills}`, x + Math.round(10 * s), y + Math.round(11 * s))
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
    const s = this.s
    const color = powerUpColors[tank.activePowerUp!] ?? '#FFF'
    const panelW = Math.round(160 * s)
    const panelH = Math.round(32 * s)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, x, y, panelW, panelH, 6)
    ctx.fill()

    // Colored indicator dot
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + Math.round(14 * s), y + panelH / 2, Math.round(6 * s), 0, Math.PI * 2)
    ctx.fill()

    // Power-up name
    ctx.fillStyle = color
    ctx.font = `bold ${Math.round(12 * s)}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(powerUpNames[tank.activePowerUp!] ?? tank.activePowerUp, x + Math.round(26 * s), y + panelH / 2)

    // Timer countdown
    if (tank.powerUpEndTime > 0) {
      const remaining = Math.max(0, (tank.powerUpEndTime - timestamp) / 1000)
      const remainingStr = remaining.toFixed(1) + 's'

      ctx.fillStyle = '#FFF'
      ctx.font = `bold ${Math.round(11 * s)}px Arial`
      ctx.textAlign = 'right'
      ctx.fillText(remainingStr, x + panelW - Math.round(8 * s), y + panelH / 2)

      // Progress bar below text
      const barX = x + 4
      const barY = y + panelH - Math.round(5 * s)
      const barW = panelW - 8
      const barH = Math.round(3 * s)
      const totalDuration = 10000
      const ratio = Math.min(1, Math.max(0, (tank.powerUpEndTime - timestamp) / totalDuration))

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = color
      ctx.fillRect(barX, barY, barW * ratio, barH)
    }
  }

  private renderGameInfo(ctx: CanvasRenderingContext2D, w: number, pad: number, state: GameState): void {
    const s = this.s
    const panelW = Math.round(140 * s)
    const panelH = Math.round(44 * s)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, w - panelW - pad, pad, panelW, panelH, 8)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    this.roundRect(ctx, w - panelW - pad, pad, panelW, panelH, 8)
    ctx.stroke()

    ctx.fillStyle = '#FFF'
    ctx.font = `bold ${Math.round(14 * s)}px Arial`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`Alive: ${state.playersAlive}`, w - pad - Math.round(10 * s), pad + Math.round(6 * s))

    const mins = Math.floor(state.timeElapsed / 60000)
    const secs = Math.floor((state.timeElapsed % 60000) / 1000)
    ctx.fillStyle = '#AAA'
    ctx.font = `${Math.round(13 * s)}px Arial`
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, w - pad - Math.round(10 * s), pad + Math.round(24 * s))
  }

  private renderLeaderboard(ctx: CanvasRenderingContext2D, state: GameState, myId?: string): void {
    const s = this.s
    const w = ctx.canvas.width
    const top5 = state.leaderboard.slice(0, 5)
    const panelW = Math.round(160 * s)
    const lineH = Math.round(18 * s)
    const panelH = Math.round(24 * s) + top5.length * lineH
    const panelX = w - panelW - Math.round(12 * s)
    const panelY = Math.round(66 * s)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 6)
    ctx.fill()

    ctx.fillStyle = '#FFD700'
    ctx.font = `bold ${Math.round(11 * s)}px Arial`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('LEADERBOARD', panelX + Math.round(10 * s), panelY + Math.round(5 * s))

    ctx.font = `${Math.round(11 * s)}px Arial`
    for (let i = 0; i < top5.length; i++) {
      const entry = top5[i]
      const y = panelY + Math.round(22 * s) + i * lineH
      const isMe = entry.id === myId

      if (isMe) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
        ctx.fillRect(panelX + 2, y - 2, panelW - 4, Math.round(16 * s))
      }

      ctx.fillStyle = isMe ? '#FFD700' : (entry.isAlive ? '#FFF' : '#666')
      const nameStr = entry.name.length > 10 ? entry.name.slice(0, 10) + '..' : entry.name
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}. ${nameStr}`, panelX + Math.round(10 * s), y)
      ctx.textAlign = 'right'
      ctx.fillText(`${entry.stars}`, panelX + panelW - Math.round(10 * s), y)
      ctx.textAlign = 'left'
    }
  }

  private renderCTFScores(ctx: CanvasRenderingContext2D, w: number, ctf: import('@shared/types.js').CTFState, timeRemaining: number): void {
    const s = this.s
    const panelW = Math.round(160 * s)
    const panelH = Math.round(52 * s)
    const x = (w - panelW) / 2
    const y = Math.round(10 * s)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    this.roundRect(ctx, x, y, panelW, panelH, 8)
    ctx.fill()

    // Scores row
    ctx.font = `bold ${Math.round(18 * s)}px Arial`
    ctx.textBaseline = 'middle'
    const scoreY = y + Math.round(18 * s)

    ctx.fillStyle = '#4488FF'
    ctx.textAlign = 'right'
    ctx.fillText(`${ctf.scoreA}`, x + panelW / 2 - Math.round(12 * s), scoreY)

    ctx.fillStyle = '#AAA'
    ctx.textAlign = 'center'
    ctx.fillText(':', x + panelW / 2, scoreY)

    ctx.fillStyle = '#FF4444'
    ctx.textAlign = 'left'
    ctx.fillText(`${ctf.scoreB}`, x + panelW / 2 + Math.round(12 * s), scoreY)

    // Timer row
    const mins = Math.floor(timeRemaining / 60)
    const secs = timeRemaining % 60
    const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`
    const isUrgent = timeRemaining <= 10

    if (isUrgent) {
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150)
      ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`
      ctx.font = `bold ${Math.round(14 * s)}px Arial`
    } else {
      ctx.fillStyle = '#CCC'
      ctx.font = `${Math.round(13 * s)}px Arial`
    }
    ctx.textAlign = 'center'
    ctx.fillText(timerStr, x + panelW / 2, y + Math.round(40 * s))
  }

  private renderFlagCarrierWarning(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = this.s
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200)
    ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`
    ctx.font = `bold ${Math.round(18 * s)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('У ТЕБЯ ФЛАГ!', w / 2, Math.round(52 * s))
  }

  private renderCountdown(ctx: CanvasRenderingContext2D, w: number, h: number, timeRemaining: number): void {
    // Big number countdown like in competitive games
    // Number appears and scales up while fading out — "rushing toward viewer"
    const num = Math.ceil(timeRemaining)
    if (num <= 0 || num > 7) return

    // Animation progress within this second (0 = just appeared, 1 = about to disappear)
    const frac = 1 - (timeRemaining - Math.floor(timeRemaining))
    // Adjust for ceil: we want the animation to play for each integer second
    const t = (num === timeRemaining) ? 0 : frac

    // Scale: starts at 1x, grows to ~3x
    const scale = 1 + t * 2.5
    // Opacity: starts fully visible, fades to 0
    const alpha = Math.max(0, 1 - t * 1.1)

    if (alpha <= 0) return

    ctx.save()
    ctx.globalAlpha = alpha

    // Glow effect
    ctx.shadowColor = '#FF3333'
    ctx.shadowBlur = 30 * scale

    // Text
    const fontSize = Math.min(w, h) * 0.35 * scale
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Dark outline for readability
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.lineWidth = fontSize * 0.06
    ctx.strokeText(`${num}`, w / 2, h / 2)

    // Number with gradient red-to-orange
    const grad = ctx.createLinearGradient(w / 2, h / 2 - fontSize / 2, w / 2, h / 2 + fontSize / 2)
    grad.addColorStop(0, '#FF4444')
    grad.addColorStop(0.5, '#FF6622')
    grad.addColorStop(1, '#FF4444')
    ctx.fillStyle = grad
    ctx.fillText(`${num}`, w / 2, h / 2)

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private renderStuckHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = this.s
    const onCooldown = this.unstickCooldownMs > 0
    const pulse = 0.6 + 0.3 * Math.sin(Date.now() / 300)

    const text = this.isMobile
      ? (onCooldown ? `ЗАСТРЯЛ (${Math.ceil(this.unstickCooldownMs / 1000)}с)` : 'ЗАСТРЯЛ? НАЖМИ!')
      : (onCooldown ? `ПРОБЕЛ (${Math.ceil(this.unstickCooldownMs / 1000)}с)` : 'Нажми ПРОБЕЛ если застрял')
    const textColor = onCooldown ? `rgba(150, 150, 150, ${pulse})` : `rgba(255, 220, 100, ${pulse})`

    ctx.font = `bold ${Math.round(14 * s)}px Arial`
    const textW = ctx.measureText(text).width + Math.round(30 * s) || 250
    const btnH = this.isMobile ? Math.round(44 * s) : 30
    const btnX = (w - textW) / 2
    const btnY = h - btnH - (this.isMobile ? 20 : 30)

    // Save rect for touch hit-testing
    this.stuckButtonRect = { x: btnX, y: btnY, w: textW, h: btnH }

    ctx.fillStyle = this.isMobile ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'
    this.roundRect(ctx, btnX, btnY, textW, btnH, 8)
    ctx.fill()

    if (this.isMobile && !onCooldown) {
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.6)'
      ctx.lineWidth = 2
      this.roundRect(ctx, btnX, btnY, textW, btnH, 8)
      ctx.stroke()
    }

    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, btnY + btnH / 2)
  }

  private renderShop(ctx: CanvasRenderingContext2D, w: number, h: number, tank: Tank): void {
    const s = this.s
    const shopW = Math.round(280 * s)
    const shopH = Math.round(180 * s)
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
    ctx.font = `bold ${Math.round(18 * s)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('SHOP', shopX + shopW / 2, shopY + Math.round(12 * s))

    // Stars balance
    ctx.fillStyle = '#FFF'
    ctx.font = `${Math.round(13 * s)}px Arial`
    ctx.fillText(`Stars: ${tank.stars}`, shopX + shopW / 2, shopY + Math.round(36 * s))

    // Items
    const items = [
      { key: '1', name: 'Speed Boost', desc: '+50% speed (10s)', cost: 2, color: '#44FF44' },
      { key: '2', name: '+2 HP', desc: 'Instant heal', cost: 2, color: '#FF66FF' },
      { key: '3', name: 'x2 Damage', desc: 'Rockets (10s)', cost: 2, color: '#FF6600' }
    ]

    const itemY = shopY + Math.round(58 * s)
    const itemH = Math.round(32 * s)
    const itemGap = Math.round(6 * s)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const y = itemY + i * (itemH + itemGap)
      const canAfford = tank.stars >= item.cost

      // Item background
      ctx.fillStyle = canAfford ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'
      this.roundRect(ctx, shopX + Math.round(12 * s), y, shopW - Math.round(24 * s), itemH, 6)
      ctx.fill()

      // Key badge
      ctx.fillStyle = canAfford ? item.color : '#555'
      ctx.font = `bold ${Math.round(14 * s)}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`[${item.key}]`, shopX + Math.round(36 * s), y + itemH / 2)

      // Name
      ctx.fillStyle = canAfford ? '#FFF' : '#666'
      ctx.font = `bold ${Math.round(13 * s)}px Arial`
      ctx.textAlign = 'left'
      ctx.fillText(item.name, shopX + Math.round(58 * s), y + itemH / 2)

      // Cost
      ctx.fillStyle = canAfford ? '#FFD700' : '#555'
      ctx.font = `${Math.round(12 * s)}px Arial`
      ctx.textAlign = 'right'
      ctx.fillText(`${item.cost} stars`, shopX + shopW - Math.round(20 * s), y + itemH / 2)
    }

    // Close hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = `${Math.round(11 * s)}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText('Press Esc or Ь to close', shopX + shopW / 2, shopY + shopH - Math.round(14 * s))
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
