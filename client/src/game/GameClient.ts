import type { GameState, Tank, CompressedMapData, Obstacle } from '@shared/types.js'
import { ObstacleType } from '@shared/types.js'
import { BRICK_HP } from '@shared/constants.js'
import { Camera } from './Camera.js'

export class GameClient {
  playerId = ''
  roomId = ''
  state: GameState | null = null
  camera: Camera
  obstacles: Obstacle[] = []
  mapWidth = 0
  mapHeight = 0

  constructor() {
    this.camera = new Camera(1, 1)
  }

  loadMap(data: CompressedMapData): void {
    this.mapWidth = data.width
    this.mapHeight = data.height
    this.camera = new Camera(data.width, data.height)

    this.obstacles = []
    for (const entry of data.obstacles) {
      for (let i = 0; i < entry.runLength; i++) {
        this.obstacles.push({
          x: entry.x + i,
          y: entry.y,
          type: entry.type,
          hp: entry.type === ObstacleType.Brick ? BRICK_HP : 9999
        })
      }
    }
  }

  updateState(state: GameState): void {
    this.state = state

    const myTank = this.getMyTank()
    if (myTank) {
      this.camera.follow(myTank.position)
    }
  }

  getMyTank(): Tank | undefined {
    return this.state?.tanks.find(t => t.id === this.playerId)
  }
}
