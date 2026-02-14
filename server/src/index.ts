import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { config } from './config.js'
import { SocketHandler } from './network/SocketHandler.js'

const app = express()
app.use(cors({ origin: config.corsOrigin }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  }
})

new SocketHandler(io)

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tank Battle Royale server running on port ${config.port}`)
})
