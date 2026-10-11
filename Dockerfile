# API image: Alpine, production dependencies only (pruned), no npm in the final image, code owned by root and read-only
# for the unprivileged "node" user that runs it. Migrates the database on start.
#   docker build -t signal-school-api .
# Fast rebuilds: the dependency layer only changes with package-lock.json, and npm's download cache survives between
# builds (BuildKit cache mount), so a code change rebuilds in seconds.

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY docker/prune-node-modules.sh /usr/local/bin/prune-node-modules
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund --prefer-offline \
 && prune-node-modules node_modules

# Runtime system: the Node image with security updates (UPGRADE_SYSTEM=false for offline builds) and without npm, npx,
# corepack, yarn and C headers, which running the app never needs. Flattened below, so removed files take no space.
FROM ${NODE_IMAGE} AS system
ARG UPGRADE_SYSTEM=true
RUN if [ "$UPGRADE_SYSTEM" = true ]; then apk upgrade --no-cache; fi \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg /opt/yarn-* /usr/local/include /usr/local/share/doc /usr/local/share/man /root/.npm /tmp/* \
 && mkdir -p /data/uploads && chown node:node /data/uploads

FROM scratch
COPY --from=system / /
LABEL org.opencontainers.image.title="Signal School API" \
      org.opencontainers.image.source="https://github.com/AGSAVALIYA/Signal-School-Backend"
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD wget -qO /dev/null http://127.0.0.1:3000/health || exit 1
# RUN_MIGRATIONS=false when several API containers start at once and migrations run as a separate step.
CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS:-true}\" = true ]; then node scripts/migrate.js up; fi && exec node src/server.js"]
