export class InputManager {
  private keys = new Set<string>()
  private mouseX = 0
  private mouseY = 0
  private mouseDown = false

  // Camera/position state for screen→world conversion
  private cameraX = 0
  private cameraY = 0
  private cellPx = 24
  private myX = 0
  private myY = 0

  // Mobile overrides
  private mobileMove: number | null = null
  private mobileAim: number | null = null
  private mobileFire = false
  private isMobile = false

  constructor() {
    window.addEventListener('keydown', (e) => {
      // Ignore keystrokes when typing in input fields
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      this.keys.add(e.key)
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseDown = false
    })
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      this.mouseX = e.clientX - rect.left
      this.mouseY = e.clientY - rect.top
    })
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true
    })
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  updateCamera(cameraX: number, cameraY: number, cellPx: number): void {
    this.cameraX = cameraX
    this.cameraY = cameraY
    this.cellPx = cellPx
  }

  updateMyPosition(x: number, y: number): void {
    this.myX = x
    this.myY = y
  }

  getMoveAngle(): number | null {
    if (this.isMobile) return this.mobileMove

    // WASD + arrows → angle
    const up = this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W')
    const down = this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S')
    const left = this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')
    const right = this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')

    const dx = (right ? 1 : 0) - (left ? 1 : 0)
    const dy = (down ? 1 : 0) - (up ? 1 : 0)

    if (dx === 0 && dy === 0) return null

    // Convention: 0 = up (-Y), PI/2 = right, PI = down, -PI/2 = left
    return Math.atan2(dx, -dy)
  }

  getAimAngle(): number {
    if (this.isMobile && this.mobileAim !== null) return this.mobileAim

    // Convert mouse screen position to world position, then angle to tank
    const worldMouseX = this.cameraX + this.mouseX / this.cellPx
    const worldMouseY = this.cameraY + this.mouseY / this.cellPx

    const dx = worldMouseX - this.myX
    const dy = worldMouseY - this.myY

    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 0

    return Math.atan2(dx, -dy)
  }

  isFiring(): boolean {
    if (this.isMobile) return this.mobileFire
    return this.mouseDown
  }

  // Mobile control hooks
  setMobileMove(angle: number | null): void {
    this.mobileMove = angle
    this.isMobile = true
  }

  setMobileAim(angle: number | null, fire: boolean): void {
    this.mobileAim = angle
    this.mobileFire = fire
    this.isMobile = true
  }

  setIsMobile(value: boolean): void {
    this.isMobile = value
  }
}
