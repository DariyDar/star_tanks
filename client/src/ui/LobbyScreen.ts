import { MAP_INFO } from '@shared/maps/index.js'
import { TANK_COLORS } from '@shared/constants.js'
import type { MapId } from '@shared/types.js'
import type { TankColors } from '../rendering/TankRenderer.js'

// Color palette for each part (diverse colors)
const PART_PALETTES = [
  // Row 1: darker military/tread colors
  ['#3a3a3a', '#5a4a3a', '#2a4a2a', '#4a3a2a', '#2a3a5a', '#5a2a2a', '#4a4a2a', '#2a5a5a',
   '#6a5a4a', '#3a5a3a', '#5a3a5a', '#4a6a4a'],
  // Row 2: body colors (vibrant)
  ['#4488FF', '#FF4444', '#44CC44', '#FFAA00', '#CC44CC', '#44CCCC', '#FF6644', '#88FF44',
   '#4466FF', '#FF44AA', '#AAFF44', '#44AAFF'],
  // Row 3: turret colors (slightly muted)
  ['#3366CC', '#CC3333', '#33AA33', '#CC8800', '#AA33AA', '#33AAAA', '#CC5533', '#66CC33',
   '#3355CC', '#CC3388', '#88CC33', '#3388CC'],
  // Row 4: barrel colors (dark metallic)
  ['#333333', '#4a4a4a', '#2a2a2a', '#555555', '#3a2a2a', '#2a3a3a', '#2a2a3a', '#3a3a2a',
   '#606060', '#1a1a1a', '#4a3a3a', '#3a3a4a']
]

const PART_LABELS = ['Treads', 'Body', 'Turret', 'Barrel']
const PART_KEYS: (keyof TankColors)[] = ['treads', 'body', 'turret', 'barrel']

function loadTankColors(): TankColors {
  const saved = localStorage.getItem('tankbr_colors')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.treads && parsed.body && parsed.turret && parsed.barrel) {
        return parsed
      }
    } catch {
      // fall through to default
    }
  }
  const baseColor = localStorage.getItem('tankbr_color') ?? TANK_COLORS[0]
  return { treads: '#3a3a3a', body: baseColor, turret: '#3366CC', barrel: '#333333' }
}

export class LobbyScreen {
  private visible = true
  private playerName = localStorage.getItem('tankbr_name') ?? ''
  private selectedMap: MapId = (localStorage.getItem('tankbr_map') as MapId) || 'lakes'
  private selectedColor = localStorage.getItem('tankbr_color') ?? TANK_COLORS[0]
  private tankColors: TankColors = loadTankColors()
  private onJoin: ((name: string, mapId: MapId, color: string) => void) | null = null
  private nameInput: HTMLInputElement | null = null
  private container: HTMLDivElement | null = null
  private accountStars: number | null = null
  private errorMessage: string | null = null
  private previewCanvas: HTMLCanvasElement | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {}

  get customTankColors(): TankColors {
    return this.tankColors
  }

  show(onJoin: (name: string, mapId: MapId, color: string) => void, accountStars?: number, errorMessage?: string): void {
    this.visible = true
    this.onJoin = onJoin
    this.accountStars = accountStars ?? null
    this.errorMessage = errorMessage ?? null
    this.createUI()
  }

  updateAccountStars(stars: number): void {
    this.accountStars = stars
    if (this.visible) {
      this.hide()
      this.show(this.onJoin!, stars)
    }
  }

  hide(): void {
    this.visible = false
    this.container?.remove()
    this.container = null
    this.previewCanvas = null
  }

  get isVisible(): boolean {
    return this.visible
  }

  private createUI(): void {
    if (this.container) return

    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 40%, #0d1b2a 100%);
      color: white; font-family: 'Segoe UI', Arial, sans-serif; z-index: 10;
      overflow-y: auto; padding: 20px 0;
    `

    // Animated background particles (CSS only)
    const bgStyle = document.createElement('style')
    bgStyle.textContent = `
      @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.3; } 50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; } }
      .lobby-particle { position: fixed; width: 4px; height: 4px; background: #FFD700; border-radius: 50%; pointer-events: none; animation: float linear infinite; }
    `
    this.container.appendChild(bgStyle)

    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div')
      p.className = 'lobby-particle'
      p.style.left = `${Math.random() * 100}%`
      p.style.top = `${Math.random() * 100}%`
      p.style.animationDuration = `${3 + Math.random() * 4}s`
      p.style.animationDelay = `${Math.random() * 3}s`
      p.style.width = p.style.height = `${2 + Math.random() * 4}px`
      this.container.appendChild(p)
    }

    // Content wrapper
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      position: relative; z-index: 1; display: flex; flex-direction: column;
      align-items: center; max-width: 600px; width: 95%;
    `

    // Title with glow
    const title = document.createElement('h1')
    title.textContent = 'TANK BATTLE ROYALE'
    title.style.cssText = `
      color: #FFD700; font-size: clamp(1.3em, 4vw, 2.2em); margin: 0 0 4px 0;
      text-shadow: 0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2);
      letter-spacing: 3px; font-weight: 900;
    `
    wrapper.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.textContent = 'COLLECT STARS. SURVIVE. EXTRACT.'
    subtitle.style.cssText = `
      font-size: 10px; color: rgba(255,215,0,0.6); letter-spacing: 4px;
      margin-bottom: 12px; font-weight: 600;
    `
    wrapper.appendChild(subtitle)

    // Stars display card
    const starsCard = document.createElement('div')
    const displayStars = this.accountStars !== null ? this.accountStars : 50
    starsCard.style.cssText = `
      background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.05) 100%);
      border: 1px solid rgba(255,215,0,0.3); border-radius: 12px;
      padding: 8px 24px; margin-bottom: 4px; text-align: center;
    `
    starsCard.innerHTML = `
      <div style="font-size: 22px; color: #FFD700; font-weight: bold; text-shadow: 0 0 10px rgba(255,215,0,0.3);">★ ${displayStars}</div>
      <div style="font-size: 10px; color: rgba(255,215,0,0.5); margin-top: 1px;">YOUR STARS</div>
    `
    wrapper.appendChild(starsCard)

    const entryCost = document.createElement('div')
    entryCost.textContent = 'Entry: 2 ★'
    entryCost.style.cssText = 'font-size: 11px; color: rgba(170,170,170,0.7); margin-bottom: 10px;'
    wrapper.appendChild(entryCost)

    // Error message
    if (this.errorMessage) {
      const errorDiv = document.createElement('div')
      errorDiv.textContent = this.errorMessage
      errorDiv.style.cssText = `
        background: linear-gradient(135deg, rgba(255,60,60,0.9), rgba(200,30,30,0.9));
        color: white; padding: 8px 18px; border-radius: 10px;
        margin-bottom: 10px; font-size: 13px; font-weight: 600;
        box-shadow: 0 4px 15px rgba(255,0,0,0.3);
      `
      wrapper.appendChild(errorDiv)
    }

    // Name input
    this.nameInput = document.createElement('input')
    this.nameInput.type = 'text'
    this.nameInput.placeholder = 'Enter your name'
    this.nameInput.maxLength = 15
    this.nameInput.value = this.playerName || ''
    this.nameInput.style.cssText = `
      padding: 10px 18px; font-size: 15px; border: 2px solid rgba(255,215,0,0.4);
      background: rgba(255,255,255,0.07); color: white; border-radius: 10px;
      width: 240px; text-align: center; margin-bottom: 14px; outline: none;
      font-family: 'Segoe UI', Arial, sans-serif; transition: border-color 0.3s, box-shadow 0.3s;
    `
    this.nameInput.addEventListener('focus', () => {
      this.nameInput!.style.borderColor = 'rgba(255,215,0,0.8)'
      this.nameInput!.style.boxShadow = '0 0 15px rgba(255,215,0,0.2)'
    })
    this.nameInput.addEventListener('blur', () => {
      this.nameInput!.style.borderColor = 'rgba(255,215,0,0.4)'
      this.nameInput!.style.boxShadow = 'none'
    })
    wrapper.appendChild(this.nameInput)

    // Tank customization section (color pickers + preview)
    const customSection = document.createElement('div')
    customSection.style.cssText = `
      width: 100%; margin-bottom: 14px;
      display: flex; gap: 16px; align-items: flex-start; justify-content: center;
      flex-wrap: wrap;
    `

    // Left: 4 color picker rows
    const colorPickers = document.createElement('div')
    colorPickers.style.cssText = 'display: flex; flex-direction: column; gap: 6px;'

    const colorSectionTitle = document.createElement('div')
    colorSectionTitle.textContent = 'CUSTOMIZE TANK'
    colorSectionTitle.style.cssText = `
      font-size: 11px; letter-spacing: 2px; color: rgba(170,170,170,0.7);
      margin-bottom: 4px; text-align: center;
    `
    colorPickers.appendChild(colorSectionTitle)

    for (let partIdx = 0; partIdx < 4; partIdx++) {
      const row = document.createElement('div')
      row.style.cssText = 'display: flex; align-items: center; gap: 6px;'

      const label = document.createElement('div')
      label.textContent = PART_LABELS[partIdx]
      label.style.cssText = `
        font-size: 11px; color: rgba(200,200,200,0.8); width: 50px;
        text-align: right; flex-shrink: 0;
      `
      row.appendChild(label)

      const palette = PART_PALETTES[partIdx]
      const grid = document.createElement('div')
      grid.style.cssText = 'display: flex; gap: 3px; flex-wrap: wrap;'

      for (const color of palette) {
        const swatch = document.createElement('div')
        const key = PART_KEYS[partIdx]
        const isSelected = this.tankColors[key] === color
        swatch.style.cssText = `
          width: 22px; height: 22px; border-radius: 4px; cursor: pointer;
          background: ${color};
          border: 2px solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.1)'};
          transition: all 0.15s;
        `

        swatch.addEventListener('mouseenter', () => {
          if (this.tankColors[key] !== color) {
            swatch.style.borderColor = 'rgba(255,255,255,0.4)'
          }
        })
        swatch.addEventListener('mouseleave', () => {
          if (this.tankColors[key] !== color) {
            swatch.style.borderColor = 'rgba(255,255,255,0.1)'
          }
        })

        swatch.addEventListener('click', () => {
          this.tankColors = { ...this.tankColors, [key]: color }
          // Update body color for server (selectedColor is what gets sent)
          if (key === 'body') {
            this.selectedColor = color
          }
          // Update selection visuals for this row
          grid.querySelectorAll('div').forEach((s, i) => {
            const c = palette[i]
            s.style.borderColor = this.tankColors[key] === c ? '#FFD700' : 'rgba(255,255,255,0.1)'
          })
          this.renderTankPreview()
        })

        grid.appendChild(swatch)
      }

      row.appendChild(grid)
      colorPickers.appendChild(row)
    }

    customSection.appendChild(colorPickers)

    // Right: Live tank preview canvas
    const previewWrapper = document.createElement('div')
    previewWrapper.style.cssText = `
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    `

    const previewLabel = document.createElement('div')
    previewLabel.textContent = 'PREVIEW'
    previewLabel.style.cssText = `
      font-size: 10px; letter-spacing: 2px; color: rgba(170,170,170,0.6);
    `
    previewWrapper.appendChild(previewLabel)

    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = 120
    this.previewCanvas.height = 120
    this.previewCanvas.style.cssText = `
      border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      background: rgba(0,0,0,0.3);
    `
    previewWrapper.appendChild(this.previewCanvas)
    customSection.appendChild(previewWrapper)

    wrapper.appendChild(customSection)

    // Render initial preview
    this.renderTankPreview()

    // Map selection
    const mapSection = document.createElement('div')
    mapSection.style.cssText = 'width: 100%; margin-bottom: 16px;'

    const mapTitle = document.createElement('div')
    mapTitle.textContent = 'SELECT MAP'
    mapTitle.style.cssText = `
      font-size: 11px; letter-spacing: 2px; color: rgba(170,170,170,0.7);
      margin-bottom: 6px; text-align: center;
    `
    mapSection.appendChild(mapTitle)

    const mapGrid = document.createElement('div')
    mapGrid.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;'

    for (const info of MAP_INFO) {
      const btn = document.createElement('button')
      const isSelected = info.id === this.selectedMap
      btn.style.cssText = `
        padding: 10px 14px; font-size: 12px;
        border: 2px solid ${isSelected ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.1)'};
        background: ${isSelected ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)'};
        color: white; border-radius: 10px; cursor: pointer;
        min-width: 130px; transition: all 0.2s;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: ${isSelected ? '0 0 15px rgba(255,215,0,0.15)' : 'none'};
      `
      btn.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${info.name}</div>
        <div style="color: rgba(170,170,170,0.8); font-size: 10px;">${info.description}</div>
        <div style="color: #FFD700; font-size: 10px; margin-top: 2px; opacity: 0.8;">★ ${info.botCount} bots</div>
      `

      btn.addEventListener('mouseenter', () => {
        if (info.id !== this.selectedMap) {
          btn.style.borderColor = 'rgba(255,255,255,0.3)'
          btn.style.background = 'rgba(255,255,255,0.08)'
        }
      })
      btn.addEventListener('mouseleave', () => {
        if (info.id !== this.selectedMap) {
          btn.style.borderColor = 'rgba(255,255,255,0.1)'
          btn.style.background = 'rgba(255,255,255,0.04)'
        }
      })

      btn.addEventListener('click', () => {
        this.selectedMap = info.id
        mapGrid.querySelectorAll('button').forEach(b => {
          b.style.borderColor = 'rgba(255,255,255,0.1)'
          b.style.background = 'rgba(255,255,255,0.04)'
          b.style.boxShadow = 'none'
        })
        btn.style.borderColor = 'rgba(255,215,0,0.6)'
        btn.style.background = 'rgba(255,215,0,0.1)'
        btn.style.boxShadow = '0 0 15px rgba(255,215,0,0.15)'
      })

      mapGrid.appendChild(btn)
    }
    mapSection.appendChild(mapGrid)
    wrapper.appendChild(mapSection)

    // Play button
    const playBtn = document.createElement('button')
    playBtn.textContent = 'PLAY'
    playBtn.style.cssText = `
      padding: 14px 70px; font-size: 20px; font-weight: 800;
      border: none; border-radius: 14px; cursor: pointer;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #1a1a2e; letter-spacing: 3px;
      box-shadow: 0 4px 20px rgba(255,215,0,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      font-family: 'Segoe UI', Arial, sans-serif;
    `
    playBtn.addEventListener('mouseenter', () => {
      playBtn.style.boxShadow = '0 6px 30px rgba(255,215,0,0.6)'
      playBtn.style.transform = 'translateY(-2px)'
    })
    playBtn.addEventListener('mouseleave', () => {
      playBtn.style.boxShadow = '0 4px 20px rgba(255,215,0,0.4)'
      playBtn.style.transform = 'translateY(0)'
    })
    playBtn.addEventListener('mousedown', () => { playBtn.style.transform = 'scale(0.97)' })
    playBtn.addEventListener('mouseup', () => { playBtn.style.transform = 'scale(1)' })
    playBtn.addEventListener('click', () => {
      this.playerName = this.nameInput?.value || 'Player'
      this.selectedColor = this.tankColors.body
      localStorage.setItem('tankbr_name', this.playerName)
      localStorage.setItem('tankbr_map', this.selectedMap)
      localStorage.setItem('tankbr_color', this.selectedColor)
      localStorage.setItem('tankbr_colors', JSON.stringify(this.tankColors))
      this.hide()
      this.onJoin?.(this.playerName, this.selectedMap, this.selectedColor)
    })
    wrapper.appendChild(playBtn)

    this.container.appendChild(wrapper)
    document.body.appendChild(this.container)
    this.nameInput.focus()

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') playBtn.click()
    })
  }

  private renderTankPreview(): void {
    if (!this.previewCanvas) return
    const ctx = this.previewCanvas.getContext('2d')!
    const w = this.previewCanvas.width
    const h = this.previewCanvas.height
    const cx = w / 2
    const cy = h / 2
    const s = 30 // tank scale

    ctx.clearRect(0, 0, w, h)

    const c = this.tankColors

    // Shadow
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(cx + 3, cy + 3, s * 1.1, s * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Hull (rotated slightly for visual interest)
    const hullAngle = -0.3
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(hullAngle)

    // Treads
    const treadGrad = ctx.createLinearGradient(-s, -s, -s, s)
    treadGrad.addColorStop(0, shadeHex(c.treads, -30))
    treadGrad.addColorStop(0.5, c.treads)
    treadGrad.addColorStop(1, shadeHex(c.treads, -40))

    ctx.fillStyle = treadGrad
    ctx.fillRect(-s * 1.05, -s, s * 0.35, s * 2)
    ctx.fillRect(s * 0.7, -s, s * 0.35, s * 2)

    // Tread rivets
    ctx.fillStyle = shadeHex(c.treads, -50)
    for (let i = 0; i < 6; i++) {
      const ty = -s + (i / 5) * (s * 2)
      ctx.beginPath(); ctx.arc(-s * 0.87, ty, s * 0.05, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(s * 0.87, ty, s * 0.05, 0, Math.PI * 2); ctx.fill()
    }

    // Body
    const bodyGrad = ctx.createLinearGradient(-s * 0.65, -s * 0.8, s * 0.65, s * 0.8)
    bodyGrad.addColorStop(0, shadeHex(c.body, -15))
    bodyGrad.addColorStop(0.3, c.body)
    bodyGrad.addColorStop(0.5, shadeHex(c.body, 20))
    bodyGrad.addColorStop(0.7, c.body)
    bodyGrad.addColorStop(1, shadeHex(c.body, -10))

    ctx.fillStyle = bodyGrad
    ctx.fillRect(-s * 0.65, -s * 0.8, s * 1.3, s * 1.6)
    ctx.strokeStyle = shadeHex(c.body, 40)
    ctx.lineWidth = 1.5
    ctx.strokeRect(-s * 0.65, -s * 0.8, s * 1.3, s * 1.6)

    ctx.restore()

    // Turret (different angle)
    const turretAngle = 0.2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(turretAngle)

    // Turret dome
    const turretGrad = ctx.createRadialGradient(-s * 0.1, -s * 0.1, 0, 0, 0, s * 0.4)
    turretGrad.addColorStop(0, shadeHex(c.turret, 30))
    turretGrad.addColorStop(0.5, shadeHex(c.turret, -10))
    turretGrad.addColorStop(1, shadeHex(c.turret, -40))

    ctx.fillStyle = turretGrad
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2)
    ctx.fill()

    // Turret highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath()
    ctx.arc(-s * 0.08, -s * 0.08, s * 0.12, 0, Math.PI * 2)
    ctx.fill()

    // Barrel
    const barrelGrad = ctx.createLinearGradient(-s * 0.12, 0, s * 0.12, 0)
    barrelGrad.addColorStop(0, shadeHex(c.barrel, -30))
    barrelGrad.addColorStop(0.5, c.barrel)
    barrelGrad.addColorStop(1, shadeHex(c.barrel, -20))

    ctx.fillStyle = barrelGrad
    ctx.fillRect(-s * 0.1, -s * 1.2, s * 0.2, s * 0.8)
    ctx.fillStyle = '#000'
    ctx.fillRect(-s * 0.1, -s * 1.2, s * 0.2, s * 0.08)

    ctx.restore()
  }
}

function shadeHex(color: string, amount: number): string {
  const num = parseInt(color.slice(1), 16)
  if (isNaN(num)) return color
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount))
  return `rgb(${r},${g},${b})`
}
