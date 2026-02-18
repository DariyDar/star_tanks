import BetterSqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export interface PlayerRow {
  id: string
  name: string
  total_stars: number
  games_played: number
  wins: number
  kills: number
  deaths: number
  color: string
  created_at: string
  updated_at: string
}

const INITIAL_STARS = 1000

export class GameDatabase {
  private db: BetterSqlite3.Database

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new BetterSqlite3(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_stars INTEGER NOT NULL DEFAULT ${INITIAL_STARS},
        games_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        kills INTEGER NOT NULL DEFAULT 0,
        deaths INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#4488FF',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  getOrCreatePlayer(id: string, name: string, color?: string): PlayerRow {
    const existing = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined

    if (existing) {
      if ((name && existing.name !== name) || (color && existing.color !== color)) {
        this.db.prepare(
          'UPDATE players SET name = ?, color = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(name || existing.name, color || existing.color, id)
        return this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow
      }
      return existing
    }

    this.db.prepare(
      'INSERT INTO players (id, name, total_stars, color) VALUES (?, ?, ?, ?)'
    ).run(id, name, INITIAL_STARS, color ?? '#4488FF')

    return this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow
  }

  getPlayer(id: string): PlayerRow | undefined {
    return this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined
  }

  getStars(id: string): number {
    const row = this.db.prepare('SELECT total_stars FROM players WHERE id = ?').get(id) as { total_stars: number } | undefined
    return row?.total_stars ?? 0
  }

  updateStars(id: string, delta: number): number {
    this.db.prepare(
      'UPDATE players SET total_stars = MAX(0, total_stars + ?), updated_at = datetime(\'now\') WHERE id = ?'
    ).run(delta, id)
    return this.getStars(id)
  }

  chargeEntry(id: string, cost: number): boolean {
    const stars = this.getStars(id)
    if (stars < cost) return false

    this.db.prepare(
      'UPDATE players SET total_stars = total_stars - ?, games_played = games_played + 1, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(cost, id)
    return true
  }

  recordKill(id: string): void {
    this.db.prepare(
      'UPDATE players SET kills = kills + 1, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(id)
  }

  recordDeath(id: string): void {
    this.db.prepare(
      'UPDATE players SET deaths = deaths + 1, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(id)
  }

  recordWin(id: string): void {
    this.db.prepare(
      'UPDATE players SET wins = wins + 1, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(id)
  }

  getLeaderboard(limit: number = 20): PlayerRow[] {
    return this.db.prepare(
      'SELECT * FROM players ORDER BY total_stars DESC LIMIT ?'
    ).all(limit) as PlayerRow[]
  }

  close(): void {
    this.db.close()
  }
}
