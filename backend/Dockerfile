# backend/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy app
COPY . .

# If you transpile (TS), add: RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Adjust if your entry differs
CMD ["node", "server.js"]
