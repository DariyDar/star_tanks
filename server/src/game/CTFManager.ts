import type { Tank, Vec2, CTFState } from '@tank-br/shared/types.js'

const FLAG_PICKUP_RADIUS = 2
const FLAG_CAPTURE_RADIUS = 3
const FLAG_CARRIER_HP = 2

export interface CTFEvent {
  type: 'flagPickup' | 'flagCapture' | 'flagDrop' | 'flagReturn'
  team: 'a' | 'b'
  playerId?: string
}

export class CTFManager {
  private flagA: Vec2
  private flagB: Vec2
  private flagAHome: Vec2
  private flagBHome: Vec2
  private flagACarrier: string | null = null
  private flagBCarrier: string | null = null
  private flagADropped = false
  private flagBDropped = false
  private scoreA = 0
  private scoreB = 0
  private baseA: { x: number; y: number; w: number; h: number }
  private baseB: { x: number; y: number; w: number; h: number }

  constructor(
    flagA: Vec2,
    flagB: Vec2,
    baseA: { x: number; y: number; w: number; h: number },
    baseB: { x: number; y: number; w: number; h: number }
  ) {
    this.flagA = { ...flagA }
    this.flagB = { ...flagB }
    this.flagAHome = { ...flagA }
    this.flagBHome = { ...flagB }
    this.baseA = baseA
    this.baseB = baseB
  }

  update(tanks: Tank[]): CTFEvent[] {
    const events: CTFEvent[] = []

    for (const tank of tanks) {
      if (!tank.isAlive || !tank.team) continue

      const tx = tank.position.x
      const ty = tank.position.y

      // Team B tries to pick up Team A's flag
      if (tank.team === 'b' && !this.flagACarrier && !tank.hasFlag) {
        const dx = tx - this.flagA.x
        const dy = ty - this.flagA.y
        if (dx * dx + dy * dy <= FLAG_PICKUP_RADIUS * FLAG_PICKUP_RADIUS) {
          this.flagACarrier = tank.id
          tank.hasFlag = true
          tank.hp = Math.min(tank.hp, FLAG_CARRIER_HP)
          tank.maxHp = FLAG_CARRIER_HP
          this.flagADropped = false
          events.push({ type: 'flagPickup', team: 'a', playerId: tank.id })
        }
      }

      // Team A tries to pick up Team B's flag
      if (tank.team === 'a' && !this.flagBCarrier && !tank.hasFlag) {
        const dx = tx - this.flagB.x
        const dy = ty - this.flagB.y
        if (dx * dx + dy * dy <= FLAG_PICKUP_RADIUS * FLAG_PICKUP_RADIUS) {
          this.flagBCarrier = tank.id
          tank.hasFlag = true
          tank.hp = Math.min(tank.hp, FLAG_CARRIER_HP)
          tank.maxHp = FLAG_CARRIER_HP
          this.flagBDropped = false
          events.push({ type: 'flagPickup', team: 'b', playerId: tank.id })
        }
      }

      // Team B carrier delivers flag A to Team B's base
      if (tank.team === 'b' && this.flagACarrier === tank.id) {
        if (this.isInBase(tx, ty, this.baseB)) {
          this.scoreB++
          this.flagACarrier = null
          tank.hasFlag = false
          this.flagA = { ...this.flagAHome }
          this.flagADropped = false
          // Award +2 stars to all team B members
          for (const t of tanks) {
            if (t.team === 'b') t.stars += 2
          }
          events.push({ type: 'flagCapture', team: 'b', playerId: tank.id })
        }
        // Update flag position to carrier position
        this.flagA = { x: tx, y: ty }
      }

      // Team A carrier delivers flag B to Team A's base
      if (tank.team === 'a' && this.flagBCarrier === tank.id) {
        if (this.isInBase(tx, ty, this.baseA)) {
          this.scoreA++
          this.flagBCarrier = null
          tank.hasFlag = false
          this.flagB = { ...this.flagBHome }
          this.flagBDropped = false
          // Award +2 stars to all team A members
          for (const t of tanks) {
            if (t.team === 'a') t.stars += 2
          }
          events.push({ type: 'flagCapture', team: 'a', playerId: tank.id })
        }
        // Update flag position to carrier position
        this.flagB = { x: tx, y: ty }
      }

      // Friendly tank returns their dropped flag
      if (tank.team === 'a' && this.flagADropped && !this.flagACarrier) {
        const dx = tx - this.flagA.x
        const dy = ty - this.flagA.y
        if (dx * dx + dy * dy <= FLAG_PICKUP_RADIUS * FLAG_PICKUP_RADIUS) {
          this.flagA = { ...this.flagAHome }
          this.flagADropped = false
          events.push({ type: 'flagReturn', team: 'a', playerId: tank.id })
        }
      }

      if (tank.team === 'b' && this.flagBDropped && !this.flagBCarrier) {
        const dx = tx - this.flagB.x
        const dy = ty - this.flagB.y
        if (dx * dx + dy * dy <= FLAG_PICKUP_RADIUS * FLAG_PICKUP_RADIUS) {
          this.flagB = { ...this.flagBHome }
          this.flagBDropped = false
          events.push({ type: 'flagReturn', team: 'b', playerId: tank.id })
        }
      }
    }

    return events
  }

  onTankKilled(tankId: string, position: Vec2): CTFEvent[] {
    const events: CTFEvent[] = []

    if (this.flagACarrier === tankId) {
      this.flagACarrier = null
      this.flagA = { ...position }
      this.flagADropped = true
      events.push({ type: 'flagDrop', team: 'a', playerId: tankId })
    }

    if (this.flagBCarrier === tankId) {
      this.flagBCarrier = null
      this.flagB = { ...position }
      this.flagBDropped = true
      events.push({ type: 'flagDrop', team: 'b', playerId: tankId })
    }

    return events
  }

  private isInBase(x: number, y: number, base: { x: number; y: number; w: number; h: number }): boolean {
    return x >= base.x && x <= base.x + base.w && y >= base.y && y <= base.y + base.h
  }

  getState(): CTFState {
    return {
      flagA: { ...this.flagA },
      flagB: { ...this.flagB },
      flagACarrier: this.flagACarrier,
      flagBCarrier: this.flagBCarrier,
      flagADropped: this.flagADropped,
      flagBDropped: this.flagBDropped,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      baseA: { ...this.baseA },
      baseB: { ...this.baseB }
    }
  }

  get scores(): { a: number; b: number } {
    return { a: this.scoreA, b: this.scoreB }
  }
}
