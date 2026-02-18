export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  botToken: process.env.BOT_TOKEN ?? '',
  dbPath: process.env.DB_PATH ?? './data/star_tanks.db'
}
