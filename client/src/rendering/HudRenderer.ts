import type { GameState, Tank } from '@shared/types.js'

export class HudRenderer {
  render(ctx: CanvasRenderingContext2D, state: GameState, myTank: Tank | undefined): void {
    const w = ctx.canvas.width
    const pad = 10

    // Top-left: HP
    if (myTank) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(pad, pad, 120, 40)

      ctx.fillStyle = '#FFF'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`HP: ${myTank.hp}/${myTank.maxHp}`, pad + 8, pad + 5)

      ctx.fillText(`Stars: ${myTank.stars}`, pad + 8, pad + 22)
    }

    // Top-right: alive players count + time
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(w - 130 - pad, pad, 130, 40)

    ctx.fillStyle = '#FFF'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'

    ctx.fillText(`Alive: ${state.playersAlive}`, w - pad - 8, pad + 5)

    const mins = Math.floor(state.timeElapsed / 60000)
    const secs = Math.floor((state.timeElapsed % 60000) / 1000)
    ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, w - pad - 8, pad + 22)

    // Power-up indicator
    if (myTank?.activePowerUp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(pad, 55, 120, 20)
      ctx.fillStyle = '#FFD700'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`Power: ${myTank.activePowerUp}`, pad + 8, 57)
    }

    // Top-center: kill feed (placeholder)
    // Leaderboard: top 5
    this.renderLeaderboard(ctx, state, myTank?.id)
  }

  private renderLeaderboard(ctx: CanvasRenderingContext2D, state: GameState, myId?: string): void {
    const w = ctx.canvas.width
    const top5 = state.leaderboard.slice(0, 5)
    const panelW = 150
    const panelH = 20 + top5.length * 16
    const panelX = w - panelW - 10
    const panelY = 60

    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(panelX, panelY, panelW, panelH)

    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('LEADERBOARD', panelX + 8, panelY + 4)

    ctx.font = '11px Arial'
    for (let i = 0; i < top5.length; i++) {
      const entry = top5[i]
      const y = panelY + 20 + i * 16
      ctx.fillStyle = entry.id === myId ? '#FFD700' : (entry.isAlive ? '#FFF' : '#888')
      const nameStr = entry.name.length > 10 ? entry.name.slice(0, 10) + '..' : entry.name
      ctx.fillText(`${i + 1}. ${nameStr}`, panelX + 8, y)
      ctx.textAlign = 'right'
      ctx.fillText(`${entry.stars}`, panelX + panelW - 8, y)
      ctx.textAlign = 'left'
    }
  }
}
