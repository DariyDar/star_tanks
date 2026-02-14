import type { GameState, Tank, CompressedMapData, Obstacle, Vec2 } from '@shared/types.js'
import { ObstacleType, Direction } from '@shared/types.js'
import { BRICK_HP, TANK_SPEED, CELL_SIZE } from '@shared/constants.js'
import { directionToVec, clamp } from '@shared/math.js'
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
  private predictedDir: Direction = Direction.Up
  private lastPredictTime = 0

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

  applyLocalInput(moveDir: Direction | null, dt: number): void {
    if (!moveDir || !this.state) return
    const myTank = this.getMyTank()
    if (!myTank || !myTank.isAlive) return

    if (!this.predictedPos) {
      this.predictedPos = { ...myTank.position }
    }

    this.predictedDir = moveDir

    const vec = directionToVec(moveDir)
    const speed = TANK_SPEED
    const newX = this.predictedPos.x + vec.x * speed * dt
    const newY = this.predictedPos.y + vec.y * speed * dt

    // Check target cell for collision
    const targetCellX = vec.x > 0 ? Math.ceil(newX) : vec.x < 0 ? Math.floor(newX) : Math.round(newX)
    const targetCellY = vec.y > 0 ? Math.ceil(newY) : vec.y < 0 ? Math.floor(newY) : Math.round(newY)

    const cx = clamp(targetCellX, 0, this.mapWidth - 1)
    const cy = clamp(targetCellY, 0, this.mapHeight - 1)

    if (!this.obstacleSet.has(`${cx},${cy}`)) {
      this.predictedPos = {
        x: clamp(newX, 0, this.mapWidth - 1),
        y: clamp(newY, 0, this.mapHeight - 1)
      }
    } else {
      this.predictedPos = {
        x: Math.round(this.predictedPos.x),
        y: Math.round(this.predictedPos.y)
      }
    }

    this.camera.follow(this.predictedPos)
  }

  updateState(state: GameState): void {
    this.state = state

    const myTank = this.getMyTank()
    if (myTank) {
      // Reconcile: snap predicted position toward server position
      if (this.predictedPos) {
        const dx = myTank.position.x - this.predictedPos.x
        const dy = myTank.position.y - this.predictedPos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        // If too far off, snap to server
        if (dist > 3) {
          this.predictedPos = { ...myTank.position }
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

  getMyDisplayDirection(): Direction {
    return this.predictedDir
  }
}
