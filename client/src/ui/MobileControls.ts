import type { InputManager } from '../game/InputManager.js'

const JOYSTICK_RADIUS = 50
const DEAD_ZONE = 15
const FIRE_THRESHOLD = 0.3 // Normalized magnitude to start firing

interface JoystickState {
  touchId: number | null
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export class MobileControls {
  private active = false
  private moveStick: JoystickState = { touchId: null, startX: 0, startY: 0, currentX: 0, currentY: 0 }
  private aimStick: JoystickState = { touchId: null, startX: 0, startY: 0, currentX: 0, currentY: 0 }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly inputManager: InputManager
  ) {
    if (!('ontouchstart' in window)) return

    this.active = true
    this.inputManager.setIsMobile(true)

    canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false })
    canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false })
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const halfWidth = rect.width / 2

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const x = touch.clientX - rect.left

      if (x <= halfWidth) {
        // Left half — move joystick
        if (this.moveStick.touchId === null) {
          this.moveStick.touchId = touch.identifier
          this.moveStick.startX = touch.clientX
          this.moveStick.startY = touch.clientY
          this.moveStick.currentX = touch.clientX
          this.moveStick.currentY = touch.clientY
        }
      } else {
        // Right half — aim joystick
        if (this.aimStick.touchId === null) {
          this.aimStick.touchId = touch.identifier
          this.aimStick.startX = touch.clientX
          this.aimStick.startY = touch.clientY
          this.aimStick.currentX = touch.clientX
          this.aimStick.currentY = touch.clientY
        }
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault()

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]

      if (touch.identifier === this.moveStick.touchId) {
        this.moveStick.currentX = touch.clientX
        this.moveStick.currentY = touch.clientY
        this.updateMoveInput()
      }

      if (touch.identifier === this.aimStick.touchId) {
        this.aimStick.currentX = touch.clientX
        this.aimStick.currentY = touch.clientY
        this.updateAimInput()
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault()

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]

      if (touch.identifier === this.moveStick.touchId) {
        this.moveStick.touchId = null
        this.inputManager.setMobileMove(null)
      }

      if (touch.identifier === this.aimStick.touchId) {
        this.aimStick.touchId = null
        this.inputManager.setMobileAim(null, false)
      }
    }
  }

  private updateMoveInput(): void {
    const dx = this.moveStick.currentX - this.moveStick.startX
    const dy = this.moveStick.currentY - this.moveStick.startY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < DEAD_ZONE) {
      this.inputManager.setMobileMove(null)
      return
    }

    // Free angle: 0=up, PI/2=right, PI=down, -PI/2=left
    const angle = Math.atan2(dx, -dy)
    this.inputManager.setMobileMove(angle)
  }

  private updateAimInput(): void {
    const dx = this.aimStick.currentX - this.aimStick.startX
    const dy = this.aimStick.currentY - this.aimStick.startY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const normalizedDist = dist / JOYSTICK_RADIUS

    if (dist < DEAD_ZONE) {
      this.inputManager.setMobileAim(null, false)
      return
    }

    const angle = Math.atan2(dx, -dy)
    const fire = normalizedDist > FIRE_THRESHOLD
    this.inputManager.setMobileAim(angle, fire)
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return

    if (this.moveStick.touchId !== null) {
      this.renderJoystick(ctx, this.moveStick, 'rgba(100, 200, 255, 0.3)', 'rgba(100, 200, 255, 0.5)')
    }

    if (this.aimStick.touchId !== null) {
      this.renderJoystick(ctx, this.aimStick, 'rgba(255, 100, 100, 0.3)', 'rgba(255, 100, 100, 0.5)')
    }
  }

  private renderJoystick(ctx: CanvasRenderingContext2D, stick: JoystickState, baseColor: string, thumbColor: string): void {
    const rect = this.canvas.getBoundingClientRect()
    const baseX = stick.startX - rect.left
    const baseY = stick.startY - rect.top

    // Base circle
    ctx.strokeStyle = baseColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(baseX, baseY, JOYSTICK_RADIUS, 0, Math.PI * 2)
    ctx.stroke()

    // Thumb position
    const dx = stick.currentX - stick.startX
    const dy = stick.currentY - stick.startY
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), JOYSTICK_RADIUS)
    const angle = Math.atan2(dy, dx)
    const thumbX = baseX + Math.cos(angle) * dist
    const thumbY = baseY + Math.sin(angle) * dist

    ctx.fillStyle = thumbColor
    ctx.beginPath()
    ctx.arc(thumbX, thumbY, 20, 0, Math.PI * 2)
    ctx.fill()
  }

  get isActive(): boolean {
    return this.active
  }
}
