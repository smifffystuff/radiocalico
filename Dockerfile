# Base: install production dependencies only
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Development: install all dependencies, use node --watch for hot reload
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=development
CMD ["node", "--watch", "server.js"]

# Production: build on top of base (prod deps only), copy source
FROM base AS prod
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
