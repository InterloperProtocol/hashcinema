FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY workers ./workers
COPY lib ./lib
COPY prompts ./prompts

CMD ["npx", "tsx", "workers/server.ts"]
