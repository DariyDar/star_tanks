/** Lightweight server performance monitor with per-section tick breakdown */

// Section names for tick breakdown
export type TickSection = 'input' | 'botAI' | 'botFire' | 'bullets' | 'ctf' | 'stars' | 'powerups' | 'zone' | 'portals' | 'broadcast'

export class ServerStats {
  private maxHistory = 100

  // Total tick timing
  private tickTimes: number[] = []

  // Per-section timing (rolling average)
  private sectionTimes = new Map<TickSection, number[]>()

  // Per-player ping
  private playerPings = new Map<string, { name: string; ping: number }>()

  // Encoding timing
  private encodeTimes: number[] = []

  // Event counters (reset every getReport call to show rate)
  private events = { shots: 0, hits: 0, kills: 0, starsCollected: 0, flagPickups: 0, flagCaptures: 0, respawns: 0 }
  private lastReportTime = Date.now()

  // Entity counts
  private _tanks = 0
  private _bullets = 0
  private _stars = 0
  private _rooms = 0

  recordTick(durationMs: number): void {
    this.tickTimes.push(durationMs)
    if (this.tickTimes.length > this.maxHistory) this.tickTimes.shift()
  }

  recordSection(section: TickSection, durationMs: number): void {
    let arr = this.sectionTimes.get(section)
    if (!arr) { arr = []; this.sectionTimes.set(section, arr) }
    arr.push(durationMs)
    if (arr.length > this.maxHistory) arr.shift()
  }

  recordEncode(durationMs: number): void {
    this.encodeTimes.push(durationMs)
    if (this.encodeTimes.length > this.maxHistory) this.encodeTimes.shift()
  }

  recordPing(playerId: string, name: string, pingMs: number): void {
    this.playerPings.set(playerId, { name, ping: pingMs })
  }

  removePlayer(playerId: string): void {
    this.playerPings.delete(playerId)
  }

  // Event tracking
  onShot(): void { this.events.shots++ }
  onHit(): void { this.events.hits++ }
  onKill(): void { this.events.kills++ }
  onStarCollected(): void { this.events.starsCollected++ }
  onFlagPickup(): void { this.events.flagPickups++ }
  onFlagCapture(): void { this.events.flagCaptures++ }
  onRespawn(): void { this.events.respawns++ }

  updateEntities(tanks: number, bullets: number, stars: number, rooms: number): void {
    this._tanks = tanks
    this._bullets = bullets
    this._stars = stars
    this._rooms = rooms
  }

  getReport(): StatsReport {
    const now = Date.now()
    const elapsed = (now - this.lastReportTime) / 1000 // seconds since last report

    // Build section breakdown
    const sections: Record<string, { avg: number; max: number }> = {}
    for (const [name, arr] of this.sectionTimes) {
      sections[name] = { avg: round2(avg(arr)), max: round2(arr.length > 0 ? Math.max(...arr) : 0) }
    }

    // Event rates (per second)
    const eventRates = {
      shots: round2(this.events.shots / Math.max(elapsed, 1)),
      hits: round2(this.events.hits / Math.max(elapsed, 1)),
      kills: round2(this.events.kills / Math.max(elapsed, 1)),
      starsCollected: round2(this.events.starsCollected / Math.max(elapsed, 1)),
      flagPickups: this.events.flagPickups,
      flagCaptures: this.events.flagCaptures,
      respawns: this.events.respawns
    }

    // Reset counters
    this.events = { shots: 0, hits: 0, kills: 0, starsCollected: 0, flagPickups: 0, flagCaptures: 0, respawns: 0 }
    this.lastReportTime = now

    const players: PlayerStat[] = []
    for (const [id, info] of this.playerPings) {
      players.push({ id: id.slice(0, 8), name: info.name, ping: info.ping })
    }
    players.sort((a, b) => b.ping - a.ping)

    return {
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      tick: {
        avg: round2(avg(this.tickTimes)),
        max: round2(this.tickTimes.length > 0 ? Math.max(...this.tickTimes) : 0),
        samples: this.tickTimes.length
      },
      sections,
      encode: {
        avg: round2(avg(this.encodeTimes)),
        max: round2(this.encodeTimes.length > 0 ? Math.max(...this.encodeTimes) : 0)
      },
      entities: { tanks: this._tanks, bullets: this._bullets, stars: this._stars, rooms: this._rooms },
      eventRates,
      players
    }
  }
}

interface StatsReport {
  uptime: number
  memory: number
  tick: { avg: number; max: number; samples: number }
  sections: Record<string, { avg: number; max: number }>
  encode: { avg: number; max: number }
  entities: { tanks: number; bullets: number; stars: number; rooms: number }
  eventRates: { shots: number; hits: number; kills: number; starsCollected: number; flagPickups: number; flagCaptures: number; respawns: number }
  players: PlayerStat[]
}

interface PlayerStat {
  id: string
  name: string
  ping: number
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  let sum = 0
  for (const v of arr) sum += v
  return sum / arr.length
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const serverStats = new ServerStats()
