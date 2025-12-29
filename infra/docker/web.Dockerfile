FROM node:20-slim AS base
WORKDIR /app

ENV NODE_ENV=development

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY pnpm-lock.yaml ./

COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js apps/web/next-env.d.ts apps/web/.eslintrc.json apps/web/.prettierrc apps/web/vitest.config.ts apps/web/vitest.setup.ts ./apps/web/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

RUN pnpm install

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN pnpm --filter web build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/package.json ./apps/web/package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared ./packages/shared

WORKDIR /app/apps/web
CMD ["pnpm", "start"]
