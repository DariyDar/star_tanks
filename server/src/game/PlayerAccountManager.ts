import type { GameDatabase, PlayerRow } from '../db/Database.js'

export interface PlayerAccount {
  playerId: string
  playerName: string
  totalStars: number
  gamesPlayed: number
  wins: number
  color: string
  upgrades: string[]
}

const GAME_ENTRY_COST = 10

function rowToAccount(row: PlayerRow): PlayerAccount {
  return {
    playerId: row.id,
    playerName: row.name,
    totalStars: row.total_stars,
    gamesPlayed: row.games_played,
    wins: row.wins,
    color: row.color,
    upgrades: []
  }
}

export class PlayerAccountManager {
  constructor(private readonly db: GameDatabase) {}

  getOrCreateAccount(playerId: string, playerName: string, color?: string): PlayerAccount {
    const row = this.db.getOrCreatePlayer(playerId, playerName, color)
    return rowToAccount(row)
  }

  setPlayerColor(playerId: string, color: string): void {
    const row = this.db.getPlayer(playerId)
    if (row) {
      this.db.getOrCreatePlayer(playerId, row.name, color)
    }
  }

  getAccount(playerId: string): PlayerAccount | undefined {
    const row = this.db.getPlayer(playerId)
    return row ? rowToAccount(row) : undefined
  }

  canAffordEntry(playerId: string): boolean {
    return this.db.getStars(playerId) >= GAME_ENTRY_COST
  }

  chargeEntry(playerId: string): boolean {
    return this.db.chargeEntry(playerId, GAME_ENTRY_COST)
  }

  addStarsFromPortal(playerId: string, stars: number): void {
    this.db.updateStars(playerId, stars)
  }

  recordWin(playerId: string): void {
    this.db.recordWin(playerId)
  }

  recordKill(playerId: string): void {
    this.db.recordKill(playerId)
  }

  recordDeath(playerId: string): void {
    this.db.recordDeath(playerId)
  }

  getAllAccounts(): PlayerAccount[] {
    return this.db.getLeaderboard(100).map(rowToAccount)
  }
}
