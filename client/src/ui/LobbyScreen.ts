import { MAP_INFO } from '@shared/maps/index.js'
import type { MapId } from '@shared/types.js'

export class LobbyScreen {
  private visible = true
  private playerName = ''
  private selectedMap: MapId = 'lakes'
  private onJoin: ((name: string, mapId: MapId) => void) | null = null
  private nameInput: HTMLInputElement | null = null
  private container: HTMLDivElement | null = null
  private accountStars: number | null = null
  private errorMessage: string | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {}

  show(onJoin: (name: string, mapId: MapId) => void, accountStars?: number, errorMessage?: string): void {
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
  }

  get isVisible(): boolean {
    return this.visible
  }

  private createUI(): void {
    if (this.container) return

    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #1a1a2e; color: white; font-family: Arial, sans-serif; z-index: 10;
    `

    // Title
    const title = document.createElement('h1')
    title.textContent = 'TANK BATTLE ROYALE'
    title.style.cssText = 'color: #FFD700; font-size: 2em; margin-bottom: 10px;'
    this.container.appendChild(title)

    // Account stars display
    if (this.accountStars !== null) {
      const starsDisplay = document.createElement('div')
      starsDisplay.textContent = `⭐ Your Stars: ${this.accountStars}`
      starsDisplay.style.cssText = `
        font-size: 20px; color: #FFD700; margin-bottom: 5px; font-weight: bold;
      `
      this.container.appendChild(starsDisplay)

      const entryCost = document.createElement('div')
      entryCost.textContent = 'Entry Cost: 2 ⭐'
      entryCost.style.cssText = `
        font-size: 14px; color: #AAA; margin-bottom: 15px;
      `
      this.container.appendChild(entryCost)
    }

    // Error message
    if (this.errorMessage) {
      const errorDiv = document.createElement('div')
      errorDiv.textContent = this.errorMessage
      errorDiv.style.cssText = `
        background: #ff4444; color: white; padding: 10px 20px; border-radius: 8px;
        margin-bottom: 15px; font-size: 14px;
      `
      this.container.appendChild(errorDiv)
    }

    // Name input
    this.nameInput = document.createElement('input')
    this.nameInput.type = 'text'
    this.nameInput.placeholder = 'Enter your name'
    this.nameInput.maxLength = 15
    this.nameInput.value = this.playerName || `Player${Math.floor(Math.random() * 1000)}`
    this.nameInput.style.cssText = `
      padding: 10px 20px; font-size: 16px; border: 2px solid #FFD700;
      background: #2a2a4e; color: white; border-radius: 8px; width: 250px;
      text-align: center; margin-bottom: 20px; outline: none;
    `
    this.container.appendChild(this.nameInput)

    // Map selection title
    const mapTitle = document.createElement('div')
    mapTitle.textContent = 'Select Map:'
    mapTitle.style.cssText = 'font-size: 18px; margin-bottom: 10px; color: #AAA;'
    this.container.appendChild(mapTitle)

    // Map buttons
    const mapGrid = document.createElement('div')
    mapGrid.style.cssText = 'display: flex; gap: 12px; margin-bottom: 30px; flex-wrap: wrap; justify-content: center;'

    for (const info of MAP_INFO) {
      const btn = document.createElement('button')
      btn.style.cssText = `
        padding: 15px 20px; font-size: 14px; border: 2px solid #555;
        background: #2a2a4e; color: white; border-radius: 8px; cursor: pointer;
        min-width: 150px; transition: all 0.2s;
      `
      btn.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${info.name}</div>
        <div style="color: #AAA; font-size: 12px;">${info.description}</div>
        <div style="color: #FFD700; font-size: 12px; margin-top: 4px;">Bots: ${info.botCount}</div>
      `

      if (info.id === this.selectedMap) {
        btn.style.borderColor = '#FFD700'
        btn.style.background = '#3a3a5e'
      }

      btn.addEventListener('click', () => {
        this.selectedMap = info.id
        // Update selection visuals
        mapGrid.querySelectorAll('button').forEach(b => {
          b.style.borderColor = '#555'
          b.style.background = '#2a2a4e'
        })
        btn.style.borderColor = '#FFD700'
        btn.style.background = '#3a3a5e'
      })

      mapGrid.appendChild(btn)
    }
    this.container.appendChild(mapGrid)

    // Play button
    const playBtn = document.createElement('button')
    playBtn.textContent = 'PLAY'
    playBtn.style.cssText = `
      padding: 15px 60px; font-size: 20px; font-weight: bold;
      border: none; background: #FFD700; color: #333; border-radius: 12px;
      cursor: pointer; transition: transform 0.1s;
    `
    playBtn.addEventListener('mousedown', () => { playBtn.style.transform = 'scale(0.95)' })
    playBtn.addEventListener('mouseup', () => { playBtn.style.transform = 'scale(1)' })
    playBtn.addEventListener('click', () => {
      this.playerName = this.nameInput?.value || 'Player'
      this.hide()
      this.onJoin?.(this.playerName, this.selectedMap)
    })
    this.container.appendChild(playBtn)

    document.body.appendChild(this.container)
    this.nameInput.focus()

    // Enter key
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') playBtn.click()
    })
  }
}
