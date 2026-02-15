import type { Bullet } from '@shared/types.js'
import { GameClient } from './game/GameClient.js'
import { InputManager } from './game/InputManager.js'
import { Renderer } from './rendering/Renderer.js'
import { SocketClient } from './network/SocketClient.js'
import { StateBuffer } from './network/StateBuffer.js'
import { ResultScreen } from './ui/ResultScreen.js'
import { MobileControls } from './ui/MobileControls.js'
import { LobbyScreen } from './ui/LobbyScreen.js'

const canvas = document.getElementById('game') as HTMLCanvasElement
canvas.tabIndex = 1 // Make canvas focusable for keyboard input
canvas.style.outline = 'none' // Remove focus outline
const client = new GameClient()
const input = new InputManager()
input.setCanvas(canvas)
const renderer = new Renderer(canvas)
const stateBuffer = new StateBuffer()
const resultScreen = new ResultScreen(canvas)
const mobileControls = new MobileControls(canvas, input)
const lobby = new LobbyScreen(canvas)

let sequenceNumber = 0
let joined = false
let lastPlayerName = 'Player'
let lastMapId = 'lakes'
let lastLeaderboard: import('@shared/types.js').LeaderboardEntry[] = []
let lastFrameTime = performance.now()
let inputSendTimer = 0
let accountStars: number | null = null
let lastError: string | null = null
const INPUT_SEND_INTERVAL = 50 // Send input at 20Hz (same as server tick)

// Bullet impact tracking
let prevBullets: Map<string, Bullet> = new Map()
let wasFiring = false

function joinGame(name: string, mapId: string, color: string) {
  lastPlayerName = name
  lastMapId = mapId
  stateBuffer.clear()
  sequenceNumber = 0
  joined = false

  if (socket.connected) {
    socket.join(name, mapId, color)
  }
}

function showLobby() {
  lobby.show((name, mapId, color) => {
    lastError = null  // Clear error when attempting to join
    joinGame(name, mapId, color)
  }, accountStars ?? undefined, lastError ?? undefined)
}

const socket = new SocketClient({
  onJoined(payload) {
    client.playerId = payload.playerId
    client.roomId = payload.roomId
    client.loadMap(payload.mapData)
    renderer.loadMap(client)
    renderer.effects.reset()
    resultScreen.hide()
    lobby.hide()
    canvas.focus() // Return keyboard focus to game
    joined = true

    // Store account stars if provided
    const binaryPayload = payload as import('@shared/protocol.js').ServerJoinedPayloadBinary
    if (binaryPayload.accountStars !== undefined) {
      accountStars = binaryPayload.accountStars
    }
  },

  onState(state) {
    stateBuffer.push(state)
    lastLeaderboard = state.leaderboard
  },

  onKill(payload) {
    const deadTank = client.state?.tanks.find(t => t.id === payload.deadId)
    if (deadTank) {
      renderer.effects.addExplosion(deadTank.position.x, deadTank.position.y)
    }
  },

  onPortalExit(payload) {
    if (payload.playerId === client.playerId) {
      // Update account stars with new balance
      if (payload.newAccountBalance !== undefined) {
        accountStars = payload.newAccountBalance
      }

      const fadeColor = payload.stars > 0 ? 'white' as const : 'black' as const
      renderer.effects.startFade(fadeColor)

      setTimeout(() => {
        resultScreen.show(payload.stars, lastLeaderboard, () => {
          showLobby()
        })
      }, 3000)
    }
  },

  onGameOver(payload) {
    const myEntry = payload.leaderboard.find(e => e.id === client.playerId)
    const stars = myEntry?.stars ?? 0
    const fadeColor = stars > 0 ? 'white' as const : 'black' as const
    renderer.effects.startFade(fadeColor)

    setTimeout(() => {
      resultScreen.show(stars, payload.leaderboard, () => {
        showLobby()
      })
    }, 3000)
  },

  onError(message) {
    // Store error and show lobby with error message
    lastError = message
    if (!joined) {
      showLobby()
    }
  },

  onDisconnect() {
    joined = false
  }
})

socket.connect()

// Show lobby on start
showLobby()

// Ping every 5 seconds
setInterval(() => {
  if (socket.connected) socket.ping()
}, 5000)

// Game loop
function gameLoop(now: number) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1) // cap at 100ms
  lastFrameTime = now

  if (joined && !resultScreen.isVisible && !lobby.isVisible) {
    // Update camera/position for mouse→world conversion
    input.updateCamera(client.camera.x, client.camera.y, renderer.currentCellPx)
    const myPos = client.getMyDisplayPosition()
    if (myPos) {
      input.updateMyPosition(myPos.x, myPos.y)
    }

    const moveAngle = input.getMoveAngle()
    const aimAngle = input.getAimAngle()

    // Apply input locally for instant response
    client.applyLocalInput(moveAngle, aimAngle, dt)

    // Send input to server at fixed rate
    inputSendTimer += dt * 1000
    if (inputSendTimer >= INPUT_SEND_INTERVAL) {
      inputSendTimer -= INPUT_SEND_INTERVAL
      socket.sendInput({
        tick: client.state?.tick ?? 0,
        sequenceNumber: sequenceNumber++,
        moveAngle,
        aimAngle,
        fire: input.isFiring()
      })
    }

    // Recoil on fire start
    const firing = input.isFiring()
    if (firing && !wasFiring) {
      renderer.effects.triggerRecoil(aimAngle)
    }
    wasFiring = firing

    // Get interpolated state from server
    const state = stateBuffer.getInterpolatedState()
    if (state) {
      // Detect bullet impacts (bullets that vanished = hit something)
      const currentBullets = new Map(state.bullets.map(b => [b.id, b]))
      for (const [id, prev] of prevBullets) {
        if (!currentBullets.has(id)) {
          // Bullet disappeared — add impact effect at last known position
          renderer.effects.addBulletImpact(prev.position.x, prev.position.y)
        }
      }
      prevBullets = currentBullets

      client.updateState(state)
    }
  }

  if (lobby.isVisible) {
    // Lobby handles its own UI via DOM
  } else if (resultScreen.isVisible) {
    resultScreen.render(canvas.getContext('2d')!)
  } else {
    renderer.render(client)
    if (mobileControls.isActive) {
      mobileControls.render(canvas.getContext('2d')!)
    }
  }

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)
