import type { Camera } from '../game/Camera.js'
import { PORTAL_EXIT_FADE_DURATION } from '@shared/constants.js'

interface Explosion {
  x: number
  y: number
  startTime: number
  duration: number
  particles: ExplosionParticle[]
}

interface ExplosionParticle {
  angle: number
  speed: number
  size: number
  color: string
}

interface BulletImpact {
  x: number
  y: number
  startTime: number
  duration: number
}

interface MuzzleFlash {
  x: number
  y: number
  angle: number
  startTime: number
  duration: number
}

interface SmokeParticle {
  x: number
  y: number
  vx: number
  vy: number
  startTime: number
  duration: number
  size: number
}

interface TankTrail {
  x: number
  y: number
  angle: number
  startTime: number
  duration: number
}

export class EffectsRenderer {
  private explosions: Explosion[] = []
  private bulletImpacts: BulletImpact[] = []
  private muzzleFlashes: MuzzleFlash[] = []
  private smokeParticles: SmokeParticle[] = []
  private tankTrails: TankTrail[] = []
  private fadeStartTime = 0
  private fadeColor: 'white' | 'black' | null = null
  private fadeDuration = PORTAL_EXIT_FADE_DURATION

  // Screen shake
  private shakeIntensity = 0
  private shakeDecay = 0.88
  shakeOffsetX = 0
  shakeOffsetY = 0

  // Recoil (local player tank)
  private recoilAngle = 0
  private recoilMagnitude = 0
  recoilOffsetX = 0
  recoilOffsetY = 0

  addExplosion(x: number, y: number): void {
    // Create particles for the explosion
    const particles: ExplosionParticle[] = []
    const particleCount = 20
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5
      particles.push({
        angle,
        speed: 0.15 + Math.random() * 0.15,
        size: 0.1 + Math.random() * 0.15,
        color: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF6600' : '#FF3300'
      })
    }

    this.explosions.push({
      x, y,
      startTime: Date.now(),
      duration: 800,
      particles
    })
    this.addScreenShake(6)

    // Add smoke particles
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.02 + Math.random() * 0.03
      this.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.02, // Rise up
        startTime: Date.now() + Math.random() * 200,
        duration: 1200,
        size: 0.3 + Math.random() * 0.3
      })
    }
  }

  addBulletImpact(x: number, y: number): void {
    this.bulletImpacts.push({
      x, y,
      startTime: Date.now(),
      duration: 300
    })
    this.addScreenShake(2)

    // Add small smoke puff
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.01 + Math.random() * 0.02
      this.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 0.1,
        y: y + (Math.random() - 0.5) * 0.1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.01,
        startTime: Date.now(),
        duration: 500,
        size: 0.1 + Math.random() * 0.1
      })
    }
  }

  addMuzzleFlash(x: number, y: number, angle: number): void {
    this.muzzleFlashes.push({
      x, y, angle,
      startTime: Date.now(),
      duration: 80
    })

    // Add muzzle smoke
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.3
      this.smokeParticles.push({
        x: x + Math.sin(angle) * 0.5,
        y: y - Math.cos(angle) * 0.5,
        vx: Math.sin(angle + spread) * 0.04,
        vy: -Math.cos(angle + spread) * 0.04 - 0.01,
        startTime: Date.now(),
        duration: 600,
        size: 0.15 + Math.random() * 0.1
      })
    }
  }

  addTankTrail(x: number, y: number, angle: number): void {
    // Only add trail occasionally (not every frame)
    if (Math.random() > 0.3) return

    this.tankTrails.push({
      x, y, angle,
      startTime: Date.now(),
      duration: 2000
    })

    // Limit trails to prevent performance issues
    if (this.tankTrails.length > 100) {
      this.tankTrails.shift()
    }
  }

  addScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
  }

  triggerRecoil(angle: number): void {
    this.recoilAngle = angle
    this.recoilMagnitude = 0.12
  }

  startFade(color: 'white' | 'black'): void {
    this.fadeStartTime = Date.now()
    this.fadeColor = color
  }

  get isFading(): boolean {
    return this.fadeColor !== null && (Date.now() - this.fadeStartTime) < this.fadeDuration
  }

  get fadeComplete(): boolean {
    return this.fadeColor !== null && (Date.now() - this.fadeStartTime) >= this.fadeDuration
  }

  updateShake(): void {
    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity
      this.shakeIntensity *= this.shakeDecay
    } else {
      this.shakeIntensity = 0
      this.shakeOffsetX = 0
      this.shakeOffsetY = 0
    }

    if (this.recoilMagnitude > 0.005) {
      this.recoilOffsetX = Math.sin(this.recoilAngle) * this.recoilMagnitude
      this.recoilOffsetY = -Math.cos(this.recoilAngle) * this.recoilMagnitude
      this.recoilMagnitude *= 0.75
    } else {
      this.recoilMagnitude = 0
      this.recoilOffsetX = 0
      this.recoilOffsetY = 0
    }
  }

  renderExplosions(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.explosions = this.explosions.filter(e => now - e.startTime < e.duration)

    for (const exp of this.explosions) {
      const t = (now - exp.startTime) / exp.duration
      const { sx, sy } = camera.worldToScreen(exp.x, exp.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      // Multiple expanding shockwave rings
      for (let ring = 0; ring < 3; ring++) {
        const ringDelay = ring * 0.1
        const ringT = Math.max(0, Math.min(1, (t - ringDelay) / (1 - ringDelay)))
        if (ringT <= 0) continue

        const maxR = cellPx * (1.8 - ring * 0.3)
        const r = maxR * ringT
        const alpha = (1 - ringT) * 0.6

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `rgba(255, 220, 100, ${alpha})`)
        grad.addColorStop(0.4, `rgba(255, 120, 30, ${alpha * 0.7})`)
        grad.addColorStop(0.7, `rgba(255, 50, 0, ${alpha * 0.4})`)
        grad.addColorStop(1, `rgba(100, 0, 0, 0)`)

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Flying particles
      for (const particle of exp.particles) {
        const particleT = Math.min(1, t * 1.5) // Particles move faster
        const dist = particle.speed * cellPx * 3 * particleT
        const px = cx + Math.cos(particle.angle) * dist
        const py = cy + Math.sin(particle.angle) * dist + cellPx * 0.5 * particleT * particleT // Gravity

        const particleAlpha = (1 - particleT) * 0.9
        const particleSize = particle.size * cellPx * (1 - particleT * 0.5)

        // Particle glow
        ctx.shadowBlur = 8
        ctx.shadowColor = particle.color

        // Convert hex color to rgba
        const hexToRgba = (hex: string, alpha: number) => {
          const num = parseInt(hex.slice(1), 16)
          const r = (num >> 16) & 0xFF
          const g = (num >> 8) & 0xFF
          const b = num & 0xFF
          return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }

        ctx.fillStyle = hexToRgba(particle.color, particleAlpha)
        ctx.beginPath()
        ctx.arc(px, py, particleSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Central flash (early phase)
      if (t < 0.3) {
        const flashT = t / 0.3
        const flashAlpha = (1 - flashT) * 0.8
        const flashR = cellPx * 0.8 * (1 + flashT)

        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`
        ctx.beginPath()
        ctx.arc(cx, cy, flashR, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  renderBulletImpacts(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.bulletImpacts = this.bulletImpacts.filter(e => now - e.startTime < e.duration)

    for (const impact of this.bulletImpacts) {
      const t = (now - impact.startTime) / impact.duration
      const { sx, sy } = camera.worldToScreen(impact.x, impact.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      // Flash
      const flashR = cellPx * 0.4 * (1 + t)
      const flashAlpha = (1 - t) * 0.8
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashR)
      grad.addColorStop(0, `rgba(255, 220, 100, ${flashAlpha})`)
      grad.addColorStop(0.4, `rgba(255, 140, 20, ${flashAlpha * 0.5})`)
      grad.addColorStop(1, `rgba(255, 80, 0, 0)`)

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, flashR, 0, Math.PI * 2)
      ctx.fill()

      // Sparks
      if (t < 0.6) {
        const sparkCount = 6
        const sparkAlpha = (1 - t / 0.6) * 0.9
        ctx.fillStyle = `rgba(255, 200, 50, ${sparkAlpha})`
        for (let i = 0; i < sparkCount; i++) {
          const angle = (i / sparkCount) * Math.PI * 2 + t * 4
          const sparkDist = cellPx * 0.15 + cellPx * 0.5 * t
          const sparkX = cx + Math.cos(angle) * sparkDist
          const sparkY = cy + Math.sin(angle) * sparkDist
          const sparkR = 2 * (1 - t / 0.6)
          ctx.beginPath()
          ctx.arc(sparkX, sparkY, sparkR, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  renderPortals(
    ctx: CanvasRenderingContext2D,
    portals: Array<{ position: { x: number; y: number } }>,
    camera: Camera,
    cellPx: number
  ): void {
    const now = Date.now()
    for (const portal of portals) {
      if (!camera.isVisible(portal.position.x, portal.position.y)) continue

      const { sx, sy } = camera.worldToScreen(portal.position.x, portal.position.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const angle = now / 500
      const pulse = 0.8 + Math.sin(now / 300) * 0.2
      const r = cellPx * 0.45 * pulse

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)

      ctx.strokeStyle = '#00FFFF'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.4)')
      grad.addColorStop(1, 'rgba(0, 100, 255, 0.1)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'
      ctx.lineWidth = 1
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath()
        const armAngle = (arm * Math.PI * 2) / 3
        for (let t = 0; t < 1; t += 0.05) {
          const spiralR = r * t
          const spiralAngle = armAngle + t * Math.PI * 2
          const px = spiralR * Math.cos(spiralAngle)
          const py = spiralR * Math.sin(spiralAngle)
          if (t === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  renderMuzzleFlashes(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.muzzleFlashes = this.muzzleFlashes.filter(m => now - m.startTime < m.duration)

    for (const flash of this.muzzleFlashes) {
      const t = (now - flash.startTime) / flash.duration
      const { sx, sy } = camera.worldToScreen(flash.x, flash.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(flash.angle)

      // Flash cone
      const flashLength = cellPx * 0.6 * (1 - t)
      const flashWidth = cellPx * 0.4 * (1 - t)
      const alpha = (1 - t) * 0.9

      const grad = ctx.createLinearGradient(0, 0, 0, flashLength)
      grad.addColorStop(0, `rgba(255, 255, 200, ${alpha})`)
      grad.addColorStop(0.5, `rgba(255, 200, 50, ${alpha * 0.7})`)
      grad.addColorStop(1, `rgba(255, 100, 0, 0)`)

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-flashWidth / 2, flashLength)
      ctx.lineTo(flashWidth / 2, flashLength)
      ctx.closePath()
      ctx.fill()

      // Bright core
      ctx.shadowBlur = 10
      ctx.shadowColor = '#FFFF00'
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(0, 0, cellPx * 0.15 * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.restore()
    }
  }

  renderSmokeParticles(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.smokeParticles = this.smokeParticles.filter(s => now - s.startTime < s.duration)

    for (const smoke of this.smokeParticles) {
      if (now < smoke.startTime) continue

      const t = (now - smoke.startTime) / smoke.duration
      const x = smoke.x + smoke.vx * (now - smoke.startTime) / 16.67
      const y = smoke.y + smoke.vy * (now - smoke.startTime) / 16.67

      if (!camera.isVisible(x, y)) continue

      const { sx, sy } = camera.worldToScreen(x, y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const size = smoke.size * cellPx * (1 + t * 0.5) // Expand over time
      const alpha = (1 - t) * 0.4

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size)
      grad.addColorStop(0, `rgba(80, 80, 80, ${alpha})`)
      grad.addColorStop(0.5, `rgba(60, 60, 60, ${alpha * 0.6})`)
      grad.addColorStop(1, `rgba(40, 40, 40, 0)`)

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  renderTankTrails(ctx: CanvasRenderingContext2D, camera: Camera, cellPx: number): void {
    const now = Date.now()
    this.tankTrails = this.tankTrails.filter(t => now - t.startTime < t.duration)

    for (const trail of this.tankTrails) {
      if (!camera.isVisible(trail.x, trail.y)) continue

      const t = (now - trail.startTime) / trail.duration
      const { sx, sy } = camera.worldToScreen(trail.x, trail.y, cellPx)
      const cx = sx + cellPx / 2
      const cy = sy + cellPx / 2

      const alpha = (1 - t) * 0.15

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(trail.angle)

      // Two track marks (left and right)
      const trackWidth = cellPx * 0.15
      const trackOffset = cellPx * 0.25

      for (const side of [-1, 1]) {
        ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`
        ctx.fillRect(-trackWidth / 2 + side * trackOffset, -cellPx * 0.15, trackWidth, cellPx * 0.3)

        // Track treads
        ctx.strokeStyle = `rgba(40, 40, 40, ${alpha})`
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
          const y = -cellPx * 0.1 + i * cellPx * 0.1
          ctx.beginPath()
          ctx.moveTo(-trackWidth / 2 + side * trackOffset, y)
          ctx.lineTo(trackWidth / 2 + side * trackOffset, y)
          ctx.stroke()
        }
      }

      ctx.restore()
    }
  }

  renderFade(ctx: CanvasRenderingContext2D): void {
    if (!this.fadeColor) return

    const elapsed = Date.now() - this.fadeStartTime
    const alpha = Math.min(1, elapsed / this.fadeDuration)

    ctx.fillStyle = this.fadeColor === 'white'
      ? `rgba(255, 255, 255, ${alpha})`
      : `rgba(0, 0, 0, ${alpha})`
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  renderPortalArrow(
    ctx: CanvasRenderingContext2D,
    myPos: { x: number; y: number },
    portalPos: { x: number; y: number },
    canvasSize: number
  ): void {
    const dx = portalPos.x - myPos.x
    const dy = portalPos.y - myPos.y
    const angle = Math.atan2(dy, dx)

    const arrowDist = canvasSize / 2 - 30
    const arrowX = canvasSize / 2 + Math.cos(angle) * arrowDist
    const arrowY = canvasSize / 2 + Math.sin(angle) * arrowDist

    ctx.save()
    ctx.translate(arrowX, arrowY)
    ctx.rotate(angle)

    ctx.fillStyle = '#00FFFF'
    ctx.beginPath()
    ctx.moveTo(12, 0)
    ctx.lineTo(-6, -8)
    ctx.lineTo(-6, 8)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  reset(): void {
    this.explosions = []
    this.bulletImpacts = []
    this.muzzleFlashes = []
    this.smokeParticles = []
    this.tankTrails = []
    this.fadeColor = null
    this.shakeIntensity = 0
    this.shakeOffsetX = 0
    this.shakeOffsetY = 0
    this.recoilMagnitude = 0
    this.recoilOffsetX = 0
    this.recoilOffsetY = 0
  }
}
