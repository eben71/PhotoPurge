# Web Dockerfile
FROM node:20-slim AS deps
WORKDIR /app
COPY ../../pnpm-lock.yaml ./pnpm-lock.yaml
COPY ../../package.json ./package.json
COPY ../../pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY ../../tsconfig.base.json ./tsconfig.base.json
COPY package.json ./app/package.json
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY ../../packages ./packages
COPY ../../tsconfig.base.json ./
RUN corepack enable && pnpm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

CMD ["pnpm", "start"]
