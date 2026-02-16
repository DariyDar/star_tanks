/** Lightweight server performance monitor */
export class ServerStats {
  // Tick timing (rolling window of last 100 ticks)
  private tickTimes: number[] = []
  private maxTickHistory = 100

  // Per-player ping
  private playerPings = new Map<string, { name: string; ping: number; lastUpdate: number }>()

  // Encoding timing
  private encodeTimes: number[] = []

  // Entity counts (latest)
  private _tanks = 0
  private _bullets = 0
  private _stars = 0
  private _rooms = 0

  recordTick(durationMs: number): void {
    this.tickTimes.push(durationMs)
    if (this.tickTimes.length > this.maxTickHistory) this.tickTimes.shift()
  }

  recordEncode(durationMs: number): void {
    this.encodeTimes.push(durationMs)
    if (this.encodeTimes.length > this.maxTickHistory) this.encodeTimes.shift()
  }

  recordPing(playerId: string, name: string, pingMs: number): void {
    this.playerPings.set(playerId, { name, ping: pingMs, lastUpdate: Date.now() })
  }

  removePlayer(playerId: string): void {
    this.playerPings.delete(playerId)
  }

  updateEntities(tanks: number, bullets: number, stars: number, rooms: number): void {
    this._tanks = tanks
    this._bullets = bullets
    this._stars = stars
    this._rooms = rooms
  }

  getReport(): StatsReport {
    const tickAvg = avg(this.tickTimes)
    const tickMax = this.tickTimes.length > 0 ? Math.max(...this.tickTimes) : 0
    const encodeAvg = avg(this.encodeTimes)
    const encodeMax = this.encodeTimes.length > 0 ? Math.max(...this.encodeTimes) : 0

    const players: PlayerStat[] = []
    for (const [id, info] of this.playerPings) {
      players.push({ id: id.slice(0, 8), name: info.name, ping: info.ping })
    }
    players.sort((a, b) => b.ping - a.ping) // worst ping first

    return {
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      tick: { avg: round2(tickAvg), max: round2(tickMax), samples: this.tickTimes.length },
      encode: { avg: round2(encodeAvg), max: round2(encodeMax) },
      entities: { tanks: this._tanks, bullets: this._bullets, stars: this._stars, rooms: this._rooms },
      players
    }
  }
}

interface StatsReport {
  uptime: number
  memory: number
  tick: { avg: number; max: number; samples: number }
  encode: { avg: number; max: number }
  entities: { tanks: number; bullets: number; stars: number; rooms: number }
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

// Singleton
export const serverStats = new ServerStats()
