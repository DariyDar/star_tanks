export interface PlayerAccount {
  playerId: string
  playerName: string
  totalStars: number
  gamesPlayed: number
  wins: number
  color: string
  upgrades: string[]  // List of purchased upgrade IDs
}

const INITIAL_STARS = 50
const GAME_ENTRY_COST = 2

export class PlayerAccountManager {
  private accounts = new Map<string, PlayerAccount>()

  getOrCreateAccount(playerId: string, playerName: string, color?: string): PlayerAccount {
    let account = this.accounts.get(playerId)
    if (!account) {
      account = {
        playerId,
        playerName,
        totalStars: INITIAL_STARS,
        gamesPlayed: 0,
        wins: 0,
        color: color ?? '#4488FF',  // Default to first color if not specified
        upgrades: []
      }
      this.accounts.set(playerId, account)
    } else if (color && account.color !== color) {
      // Update color if player changed it
      account.color = color
    }
    return account
  }

  setPlayerColor(playerId: string, color: string): void {
    const account = this.accounts.get(playerId)
    if (account) {
      account.color = color
    }
  }

  getAccount(playerId: string): PlayerAccount | undefined {
    return this.accounts.get(playerId)
  }

  canAffordEntry(playerId: string): boolean {
    const account = this.accounts.get(playerId)
    return account ? account.totalStars >= GAME_ENTRY_COST : false
  }

  chargeEntry(playerId: string): boolean {
    const account = this.accounts.get(playerId)
    if (!account || account.totalStars < GAME_ENTRY_COST) {
      return false
    }
    account.totalStars -= GAME_ENTRY_COST
    account.gamesPlayed++
    return true
  }

  addStarsFromPortal(playerId: string, stars: number): void {
    const account = this.accounts.get(playerId)
    if (account) {
      account.totalStars += stars
    }
  }

  recordWin(playerId: string): void {
    const account = this.accounts.get(playerId)
    if (account) {
      account.wins++
    }
  }

  getAllAccounts(): PlayerAccount[] {
    return Array.from(this.accounts.values())
  }
}
