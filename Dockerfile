# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ---- Production dependencies only (no build step: plain JavaScript) ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Runtime ----
FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Application files stay root-owned and read-only for the unprivileged runtime user.
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY views ./views
COPY public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "src/server.js"]
