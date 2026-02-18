import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { SocketHandler } from './network/SocketHandler.js'
import { serverStats } from './stats/ServerStats.js'
import { GameDatabase } from './db/Database.js'

const app = express()
app.use(cors({ origin: config.corsOrigin }))

// Serve client static files from ../client/dist
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../../client/dist')
app.use(express.static(clientDist))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.get('/stats', (_req, res) => {
  res.json(serverStats.getReport())
})

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  }
})

const db = new GameDatabase(config.dbPath)
new SocketHandler(io, db)

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tank Battle Royale server running on port ${config.port}`)
})
