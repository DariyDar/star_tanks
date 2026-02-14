import { Direction } from '@shared/types.js'
import type { InputManager } from '../game/InputManager.js'

const JOYSTICK_RADIUS = 50
const DEAD_ZONE = 15

export class MobileControls {
  private active = false
  private touchId: number | null = null
  private startX = 0
  private startY = 0
  private currentX = 0
  private currentY = 0
  private direction: Direction | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly inputManager: InputManager
  ) {
    if (!('ontouchstart' in window)) return

    this.active = true

    canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false })
    canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false })
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault()
    if (this.touchId !== null) return

    const touch = e.changedTouches[0]
    const rect = this.canvas.getBoundingClientRect()
    const x = touch.clientX - rect.left

    // Only left half of screen for joystick
    if (x > rect.width / 2) return

    this.touchId = touch.identifier
    this.startX = touch.clientX
    this.startY = touch.clientY
    this.currentX = touch.clientX
    this.currentY = touch.clientY
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault()
    if (this.touchId === null) return

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier !== this.touchId) continue

      this.currentX = touch.clientX
      this.currentY = touch.clientY

      const dx = this.currentX - this.startX
      const dy = this.currentY - this.startY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < DEAD_ZONE) {
        this.direction = null
        this.inputManager.setMoveDirection(null)
        return
      }

      // Snap to 4 directions
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? Direction.Right : Direction.Left
      } else {
        this.direction = dy > 0 ? Direction.Down : Direction.Up
      }

      this.inputManager.setMoveDirection(this.direction)
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null
        this.direction = null
        this.inputManager.setMoveDirection(null)
        break
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this.touchId === null) return

    const rect = this.canvas.getBoundingClientRect()
    const baseX = this.startX - rect.left
    const baseY = this.startY - rect.top

    // Base circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(baseX, baseY, JOYSTICK_RADIUS, 0, Math.PI * 2)
    ctx.stroke()

    // Thumb position
    const dx = this.currentX - this.startX
    const dy = this.currentY - this.startY
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), JOYSTICK_RADIUS)
    const angle = Math.atan2(dy, dx)
    const thumbX = baseX + Math.cos(angle) * dist
    const thumbY = baseY + Math.sin(angle) * dist

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.beginPath()
    ctx.arc(thumbX, thumbY, 20, 0, Math.PI * 2)
    ctx.fill()
  }

  get isActive(): boolean {
    return this.active
  }
}
