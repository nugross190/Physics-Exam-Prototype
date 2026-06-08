FROM node:20-bookworm-slim

# better-sqlite3 ships prebuilt binaries; build tools are a fallback if a prebuild is missing.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=8000
# Default DB location; on Railway mount a volume at /data and set DATABASE_FILE=/data/physics-exam.db
ENV DATABASE_FILE=/data/physics-exam.db

EXPOSE 8000

CMD ["sh", "-c", "mkdir -p $(dirname $DATABASE_FILE) && node server/db/migrate.js && node server/db/seed.js && node server/app.js"]
