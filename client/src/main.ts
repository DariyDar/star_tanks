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

// Exit button (DOM element)
const exitBtn = document.createElement('button')
exitBtn.textContent = 'EXIT'
exitBtn.style.cssText = `
  position: fixed; top: 12px; right: 170px; z-index: 5;
  padding: 6px 16px; font-size: 13px; font-weight: bold;
  background: rgba(255, 50, 50, 0.7); color: #FFF;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 6px;
  cursor: pointer; display: none; font-family: Arial, sans-serif;
`
exitBtn.addEventListener('mouseenter', () => { exitBtn.style.background = 'rgba(255, 50, 50, 0.9)' })
exitBtn.addEventListener('mouseleave', () => { exitBtn.style.background = 'rgba(255, 50, 50, 0.7)' })
document.body.appendChild(exitBtn)

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

  // Apply custom tank colors from lobby to renderer
  renderer.setCustomTankColors(lobby.customTankColors)

  if (socket.connected) {
    socket.join(name, mapId, color)
  }
}

function showLobby() {
  exitBtn.style.display = 'none'
  lobby.show((name, mapId, color) => {
    lastError = null  // Clear error when attempting to join
    joinGame(name, mapId, color)
  }, accountStars ?? undefined, lastError ?? undefined)
}

function handleExit() {
  if (!joined) return
  const myTank = client.getMyTank()
  if (myTank && myTank.isAlive) {
    renderer.effects.addExplosion(myTank.position.x, myTank.position.y)
  }
  socket.leave()
  joined = false
  exitBtn.style.display = 'none'
  renderer.effects.startFade('black')
  setTimeout(() => {
    resultScreen.show(0, lastLeaderboard, () => showLobby())
  }, 1500)
}

exitBtn.addEventListener('click', handleExit)

const socket = new SocketClient({
  onJoined(payload) {
    client.playerId = payload.playerId
    client.roomId = payload.roomId
    client.loadMap(payload.mapData)
    renderer.loadMap(client)
    renderer.effects.reset()
    resultScreen.hide()
    lobby.hide()
    exitBtn.style.display = 'block'
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
      exitBtn.style.display = 'none'
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
    exitBtn.style.display = 'none'
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
    exitBtn.style.display = 'none'
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

    // Recoil and muzzle flash on fire start
    const firing = input.isFiring()
    if (firing && !wasFiring) {
      renderer.effects.triggerRecoil(aimAngle)

      // Add muzzle flash at gun barrel position
      const myTank = client.getMyTank()
      if (myTank) {
        const barrelLength = myTank.tankRadius * 1.2
        const flashX = myTank.position.x + Math.sin(myTank.turretAngle) * barrelLength
        const flashY = myTank.position.y - Math.cos(myTank.turretAngle) * barrelLength
        renderer.effects.addMuzzleFlash(flashX, flashY, myTank.turretAngle)
      }
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
