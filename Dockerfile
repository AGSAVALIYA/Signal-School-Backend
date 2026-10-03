# API image. Runs database migrations, then the server, as the unprivileged "node" user.
# docker build -t signal-school-api .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
WORKDIR /app
RUN mkdir -p /data/uploads && chown node:node /data/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD wget -qO /dev/null http://127.0.0.1:3000/health || exit 1
# RUN_MIGRATIONS=false when several API containers start at once and migrations run as a separate step.
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-true}\" = true ]; then node scripts/migrate.js up; fi && exec node src/server.js"]
