FROM node:20-alpine
WORKDIR /app

# Copy local package and backend (so file:../packages/shared resolves)
COPY packages/shared/ packages/shared/
COPY backend/ backend/

WORKDIR /app/backend
RUN npm install

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
