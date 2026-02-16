import type { LeaderboardEntry } from '@shared/types.js'

export class ResultScreen {
  private visible = false
  private stars = 0
  private isWin = false
  private leaderboard: LeaderboardEntry[] = []
  private onPlayAgain: (() => void) | null = null
  private canvas: HTMLCanvasElement
  private showTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.addEventListener('click', (e) => this.handleClick(e))
  }

  show(stars: number, leaderboard: LeaderboardEntry[], onPlayAgain: () => void): void {
    this.visible = true
    this.stars = stars
    this.isWin = stars > 0
    this.leaderboard = leaderboard
    this.onPlayAgain = onPlayAgain
    this.showTime = performance.now()
  }

  hide(): void {
    this.visible = false
  }

  get isVisible(): boolean {
    return this.visible
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return

    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const t = (performance.now() - this.showTime) / 1000 // seconds since show
    const fadeIn = Math.min(t / 0.5, 1) // 0.5s fade in

    // Background
    if (this.isWin) {
      const grad = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h / 2, h)
      grad.addColorStop(0, `rgba(60, 50, 10, ${0.95 * fadeIn})`)
      grad.addColorStop(0.5, `rgba(20, 20, 10, ${0.95 * fadeIn})`)
      grad.addColorStop(1, `rgba(5, 5, 5, ${0.97 * fadeIn})`)
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = `rgba(10, 5, 5, ${0.95 * fadeIn})`
    }
    ctx.fillRect(0, 0, w, h)

    // Floating particles for win
    if (this.isWin) {
      ctx.save()
      for (let i = 0; i < 30; i++) {
        const px = (w * 0.1) + ((i * 137.5) % w) * 0.8
        const py = h - ((t * 30 + i * 47) % h)
        const size = 2 + (i % 3)
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i)
        ctx.fillStyle = '#FFD700'
        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const scale = Math.min(w, h) / 600 // responsive scaling

    // Title
    const titleY = h * 0.16
    const titleSize = Math.max(28, 60 * scale)
    const titleScale = Math.min(fadeIn * 1.2, 1)

    ctx.save()
    ctx.translate(w / 2, titleY)
    ctx.scale(titleScale, titleScale)

    if (this.isWin) {
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
      ctx.shadowBlur = 30
      ctx.fillStyle = '#FFD700'
    } else {
      ctx.shadowColor = 'rgba(255, 50, 50, 0.5)'
      ctx.shadowBlur = 20
      ctx.fillStyle = '#FF4444'
    }
    ctx.font = `bold ${titleSize}px 'Segoe UI', Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.isWin ? 'VICTORY' : 'DEFEAT', 0, 0)
    ctx.shadowBlur = 0
    ctx.restore()

    // Stars extracted display
    const starsY = h * 0.26
    const starsSize = Math.max(18, 28 * scale)

    ctx.fillStyle = this.isWin ? '#FFD700' : 'rgba(255,255,255,0.7)'
    ctx.font = `bold ${starsSize}px 'Segoe UI', Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw star icon before text
    const starText = `★ ${this.stars} stars extracted`
    ctx.fillText(starText, w / 2, starsY)

    // Divider line
    const divW = Math.min(300, w * 0.5)
    const divY = h * 0.31
    const divGrad = ctx.createLinearGradient(w / 2 - divW / 2, 0, w / 2 + divW / 2, 0)
    divGrad.addColorStop(0, 'rgba(255,215,0,0)')
    divGrad.addColorStop(0.5, 'rgba(255,215,0,0.4)')
    divGrad.addColorStop(1, 'rgba(255,215,0,0)')
    ctx.strokeStyle = divGrad
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2 - divW / 2, divY)
    ctx.lineTo(w / 2 + divW / 2, divY)
    ctx.stroke()

    // Leaderboard header
    const lbHeaderY = h * 0.35
    const headerSize = Math.max(12, 16 * scale)

    ctx.fillStyle = 'rgba(255, 215, 0, 0.7)'
    ctx.font = `bold ${headerSize}px 'Segoe UI', Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText('LEADERBOARD', w / 2, lbHeaderY)

    // Leaderboard entries
    const entrySize = Math.max(11, 15 * scale)
    const entryGap = Math.max(18, 24 * scale)
    const top10 = this.leaderboard.slice(0, 8)
    const lbStartY = lbHeaderY + entryGap * 1.2
    const colW = Math.min(350, w * 0.6)

    for (let i = 0; i < top10.length; i++) {
      const entry = top10[i]
      const y = lbStartY + i * entryGap

      // Highlight row background for top 3
      if (i < 3) {
        const rowAlpha = (3 - i) * 0.04
        ctx.fillStyle = `rgba(255, 215, 0, ${rowAlpha})`
        this.roundRect(ctx, w / 2 - colW / 2, y - entryGap * 0.4, colW, entryGap * 0.85, 4)
        ctx.fill()
      }

      // Rank
      const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']
      ctx.fillStyle = i < 3 ? rankColors[i] : 'rgba(255,255,255,0.5)'
      ctx.font = `bold ${entrySize}px 'Segoe UI', Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${i + 1}.`, w / 2 - colW / 2 + 8, y)

      // Name
      const nameStr = entry.name.length > 12 ? entry.name.slice(0, 12) + '..' : entry.name
      ctx.fillStyle = entry.isAlive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
      ctx.font = `${entrySize}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(nameStr, w / 2 - colW / 2 + 36, y)

      // Stats
      ctx.textAlign = 'right'
      ctx.fillStyle = '#FFD700'
      ctx.font = `bold ${entrySize}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(`★${entry.stars}`, w / 2 + colW / 2 - 8, y)

      ctx.fillStyle = 'rgba(255,100,100,0.7)'
      ctx.font = `${entrySize * 0.85}px 'Segoe UI', Arial, sans-serif`
      ctx.fillText(`${entry.kills}K`, w / 2 + colW / 2 - 55, y)
    }

    // Play again button
    const btnW = Math.min(220, w * 0.4)
    const btnH = Math.max(40, 50 * scale)
    const btnX = (w - btnW) / 2
    const btnY = h * 0.88 - btnH / 2

    // Button glow
    ctx.shadowColor = 'rgba(255, 215, 0, 0.4)'
    ctx.shadowBlur = 15

    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH)
    btnGrad.addColorStop(0, '#FFD700')
    btnGrad.addColorStop(1, '#FFA500')
    ctx.fillStyle = btnGrad
    this.roundRect(ctx, btnX, btnY, btnW, btnH, 12)
    ctx.fill()
    ctx.shadowBlur = 0

    // Button text
    ctx.fillStyle = '#1a1a2e'
    ctx.font = `bold ${Math.max(14, 18 * scale)}px 'Segoe UI', Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('PLAY AGAIN', w / 2, btnY + btnH / 2)
  }

  private handleClick(e: MouseEvent): void {
    if (!this.visible) return

    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const w = this.canvas.width
    const h = this.canvas.height
    const scale = Math.min(w, h) / 600

    const btnW = Math.min(220, w * 0.4)
    const btnH = Math.max(40, 50 * scale)
    const btnX = (w - btnW) / 2
    const btnY = h * 0.88 - btnH / 2

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this.hide()
      this.onPlayAgain?.()
    }
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
