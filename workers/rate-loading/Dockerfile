# Default image: Browserbase provides the remote browser, so no Chromium needed.
FROM node:22-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --omit=optional

COPY src ./src

ENV NODE_ENV=production
ENV BROWSER_PROVIDER=browserbase
# Required at runtime:
#   APP_BASE_URL, RATE_LOADING_WORKER_KEY, BROWSERBASE_API_KEY
# Optional: RATE_LOADING_MODEL (default auto), INFOTRAVEL_EXTRA_DOMAINS, WORKER_ID, POLL_INTERVAL_MS
CMD ["node", "src/index.js"]
