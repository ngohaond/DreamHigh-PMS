# DreamHigh PMS API — production build with an external PostgreSQL connection.
# Build: docker build -t dreamhigh-api .
# Runtime: DATABASE_URL, DIRECT_URL, JWT_SECRET and CORS_ORIGINS.

FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# postinstall runs prisma generate, so the schema must already be present.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json jest.config.cjs ./
COPY src ./src
COPY scripts/bootstrap-local.cjs ./scripts/bootstrap-local.cjs

RUN npm run build \
    && test -f dist/src/main.js \
    && test -f dist/src/modules/finance/assets/dreamhigh-logo.png

ENV NODE_ENV=production
USER node
EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate:deploy && exec node dist/src/main.js"]
