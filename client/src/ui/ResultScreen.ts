import type { LeaderboardEntry } from '@shared/types.js'

export class ResultScreen {
  private visible = false
  private stars = 0
  private isWin = false
  private leaderboard: LeaderboardEntry[] = []
  private onPlayAgain: (() => void) | null = null
  private canvas: HTMLCanvasElement

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

    // Background
    ctx.fillStyle = this.isWin ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
    ctx.fillRect(0, 0, w, h)

    const textColor = this.isWin ? '#333' : '#FFF'

    // Title
    ctx.fillStyle = this.isWin ? '#FFD700' : '#FF4444'
    ctx.font = `bold ${w / 12}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      this.isWin ? 'VICTORY!' : 'DEFEAT',
      w / 2, h * 0.2
    )

    // Stars extracted
    ctx.fillStyle = textColor
    ctx.font = `${w / 18}px Arial`
    ctx.fillText(
      `Stars extracted: ${this.stars}`,
      w / 2, h * 0.32
    )

    // Leaderboard
    ctx.font = `bold ${w / 28}px Arial`
    ctx.fillStyle = this.isWin ? '#666' : '#AAA'
    ctx.fillText('LEADERBOARD', w / 2, h * 0.42)

    ctx.font = `${w / 32}px Arial`
    const top10 = this.leaderboard.slice(0, 10)
    for (let i = 0; i < top10.length; i++) {
      const entry = top10[i]
      const y = h * 0.47 + i * (w / 28)
      ctx.fillStyle = textColor
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}. ${entry.name}`, w * 0.25, y)
      ctx.textAlign = 'right'
      ctx.fillText(`${entry.stars} stars, ${entry.kills} kills`, w * 0.75, y)
    }

    // Play again button
    const btnW = w * 0.4
    const btnH = w / 12
    const btnX = (w - btnW) / 2
    const btnY = h * 0.85

    ctx.fillStyle = '#FFD700'
    ctx.fillRect(btnX, btnY, btnW, btnH)

    ctx.fillStyle = '#333'
    ctx.font = `bold ${w / 24}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('PLAY AGAIN', w / 2, btnY + btnH / 2)
  }

  private handleClick(e: MouseEvent): void {
    if (!this.visible) return

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const w = this.canvas.width
    const h = this.canvas.height

    const btnW = w * 0.4
    const btnH = w / 12
    const btnX = (w - btnW) / 2
    const btnY = h * 0.85

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this.hide()
      this.onPlayAgain?.()
    }
  }
}
