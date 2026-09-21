ARG NODE_BASE_IMAGE=node:20-bookworm-slim
FROM ${NODE_BASE_IMAGE}

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/index.js"]
