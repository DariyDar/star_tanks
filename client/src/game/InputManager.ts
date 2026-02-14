import { Direction } from '@shared/types.js'

export class InputManager {
  private keys = new Set<string>()
  private lastDirection: Direction = Direction.Up

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key)
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
    })
  }

  getMoveDirection(): Direction | null {
    if (this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W')) {
      this.lastDirection = Direction.Up
      return Direction.Up
    }
    if (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S')) {
      this.lastDirection = Direction.Down
      return Direction.Down
    }
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) {
      this.lastDirection = Direction.Left
      return Direction.Left
    }
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) {
      this.lastDirection = Direction.Right
      return Direction.Right
    }
    return null
  }

  getAimDirection(): Direction {
    return this.lastDirection
  }

  setMoveDirection(dir: Direction | null): void {
    // For mobile controls
    this.keys.clear()
    if (dir === Direction.Up) this.keys.add('ArrowUp')
    else if (dir === Direction.Down) this.keys.add('ArrowDown')
    else if (dir === Direction.Left) this.keys.add('ArrowLeft')
    else if (dir === Direction.Right) this.keys.add('ArrowRight')
  }
}
