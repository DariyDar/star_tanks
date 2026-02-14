FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/

RUN npm run build --workspace=shared
RUN npm run build --workspace=server

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/shared/dist/ shared/dist/
COPY --from=builder /app/server/dist/ server/dist/

RUN npm install --workspace=shared --workspace=server --omit=dev

ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
