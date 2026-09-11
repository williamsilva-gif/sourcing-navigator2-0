FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
# Required at runtime:
#   NAVIGATOR_API_BASE=https://project--<id>.lovable.app
#   RATE_LOADING_WORKER_TOKEN=<same value stored in the app secrets>
# Optional: WORKER_ID, POLL_INTERVAL_MS, MAX_CONCURRENCY, NAV_TIMEOUT_MS
CMD ["node", "src/index.js"]
