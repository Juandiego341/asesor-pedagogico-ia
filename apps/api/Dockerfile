# API NestJS + entorno de verificación de código (Python, pytest y librerías comunes de IA)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip util-linux ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages pytest numpy pandas scikit-learn pydantic pyyaml \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
