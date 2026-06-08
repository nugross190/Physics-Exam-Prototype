FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

# Run migrations then start. Seeding is opt-in via SEED_ON_START=1.
CMD ["sh", "-c", "node server/db/migrate.js && ([ \"$SEED_ON_START\" = \"1\" ] && node server/db/seed.js || true) && node server/app.js"]
