import type { GameState, Tank, CompressedMapData, Obstacle, Vec2 } from '@shared/types.js'
import { ObstacleType } from '@shared/types.js'
import { BRICK_HP, TANK_SPEED, TANK_RADIUS } from '@shared/constants.js'
import { angleToVec, clamp } from '@shared/math.js'
import { Camera } from './Camera.js'

export class GameClient {
  playerId = ''
  roomId = ''
  state: GameState | null = null
  camera: Camera
  obstacles: Obstacle[] = []
  private obstacleSet = new Set<string>()
  mapWidth = 0
  mapHeight = 0

  // Client-side prediction
  private predictedPos: Vec2 | null = null
  private predictedHullAngle = 0
  private predictedTurretAngle = 0

  constructor() {
    this.camera = new Camera(1, 1)
  }

  loadMap(data: CompressedMapData): void {
    this.mapWidth = data.width
    this.mapHeight = data.height
    this.camera = new Camera(data.width, data.height)

    this.obstacles = []
    this.obstacleSet.clear()
    for (const entry of data.obstacles) {
      for (let i = 0; i < entry.runLength; i++) {
        const obs: Obstacle = {
          x: entry.x + i,
          y: entry.y,
          type: entry.type,
          hp: entry.type === ObstacleType.Brick ? BRICK_HP : 9999
        }
        this.obstacles.push(obs)
        if (obs.type !== ObstacleType.Bush) {
          this.obstacleSet.add(`${obs.x},${obs.y}`)
        }
      }
    }
  }

  applyLocalInput(moveAngle: number | null, aimAngle: number, dt: number): void {
    if (!this.state) return
    const myTank = this.getMyTank()
    if (!myTank || !myTank.isAlive) return

    if (!this.predictedPos) {
      this.predictedPos = { ...myTank.position }
    }

    this.predictedTurretAngle = aimAngle

    if (moveAngle === null) {
      this.camera.follow(this.predictedPos)
      return
    }

    this.predictedHullAngle = moveAngle

    const vec = angleToVec(moveAngle)
    const speed = TANK_SPEED
    const dx = vec.x * speed * dt
    const dy = vec.y * speed * dt

    let newX = this.predictedPos.x + dx
    let newY = this.predictedPos.y + dy

    newX = clamp(newX, TANK_RADIUS, this.mapWidth - 1 - TANK_RADIUS)
    newY = clamp(newY, TANK_RADIUS, this.mapHeight - 1 - TANK_RADIUS)

    // Try full movement
    if (!this.collidesWithObstacle(newX, newY)) {
      this.predictedPos = { x: newX, y: newY }
      this.camera.follow(this.predictedPos)
      return
    }

    // Wall sliding: try X-only
    const slideX = clamp(this.predictedPos.x + dx, TANK_RADIUS, this.mapWidth - 1 - TANK_RADIUS)
    if (!this.collidesWithObstacle(slideX, this.predictedPos.y)) {
      this.predictedPos = { x: slideX, y: this.predictedPos.y }
      this.camera.follow(this.predictedPos)
      return
    }

    // Wall sliding: try Y-only
    const slideY = clamp(this.predictedPos.y + dy, TANK_RADIUS, this.mapHeight - 1 - TANK_RADIUS)
    if (!this.collidesWithObstacle(this.predictedPos.x, slideY)) {
      this.predictedPos = { x: this.predictedPos.x, y: slideY }
      this.camera.follow(this.predictedPos)
      return
    }

    // Fully blocked
    this.camera.follow(this.predictedPos)
  }

  private collidesWithObstacle(cx: number, cy: number): boolean {
    const minX = Math.floor(cx - TANK_RADIUS)
    const maxX = Math.floor(cx + TANK_RADIUS)
    const minY = Math.floor(cy - TANK_RADIUS)
    const maxY = Math.floor(cy + TANK_RADIUS)

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (!this.obstacleSet.has(`${gx},${gy}`)) continue

        const closestX = clamp(cx, gx, gx + 1)
        const closestY = clamp(cy, gy, gy + 1)
        const distX = cx - closestX
        const distY = cy - closestY

        if (distX * distX + distY * distY < TANK_RADIUS * TANK_RADIUS) {
          return true
        }
      }
    }

    return false
  }

  updateState(state: GameState): void {
    this.state = state

    // Remove destroyed obstacles from local map
    if (state.destroyedObstacles && state.destroyedObstacles.length > 0) {
      for (const pos of state.destroyedObstacles) {
        const key = `${pos.x},${pos.y}`
        if (this.obstacleSet.has(key)) {
          this.obstacleSet.delete(key)
          const idx = this.obstacles.findIndex(o => o.x === pos.x && o.y === pos.y)
          if (idx !== -1) {
            this.obstacles.splice(idx, 1)
          }
        }
      }
    }

    const myTank = this.getMyTank()
    if (myTank) {
      if (this.predictedPos) {
        const dx = myTank.position.x - this.predictedPos.x
        const dy = myTank.position.y - this.predictedPos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 5) {
          // Teleport: large desync (portal, respawn)
          this.predictedPos = { ...myTank.position }
        } else if (dist > 0.1) {
          // Very gentle blend to prevent rubber banding
          const blendFactor = 0.08  // Even softer blending
          this.predictedPos.x += dx * blendFactor
          this.predictedPos.y += dy * blendFactor
        }
      } else {
        this.predictedPos = { ...myTank.position }
      }
      this.camera.follow(this.predictedPos ?? myTank.position)
    }
  }

  getMyTank(): Tank | undefined {
    return this.state?.tanks.find(t => t.id === this.playerId)
  }

  getMyDisplayPosition(): Vec2 | undefined {
    if (this.predictedPos) return this.predictedPos
    return this.getMyTank()?.position
  }

  getMyDisplayHullAngle(): number {
    return this.predictedHullAngle
  }

  getMyDisplayTurretAngle(): number {
    return this.predictedTurretAngle
  }
}
