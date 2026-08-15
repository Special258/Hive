FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-slim

WORKDIR /app

# Run securely as non-root
RUN chown -R node:node /app
USER node

# Copy dependencies
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node . .

# Ensure secure defaults
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
