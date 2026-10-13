# Production image for the Express API
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source.
COPY src ./src

# Run as the non-root node user provided by the official image.
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
