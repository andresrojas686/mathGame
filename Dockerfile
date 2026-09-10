# Etapa 1: build del cliente (Vite) y del servidor (tsc)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Etapa 2: solo lo necesario para servir
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# El ranking vive aquí: en Dokploy hay que montar un volumen en /app/data
# o cada redeploy borra scores.json.
ENV DATA_DIR=/app/data
ENV PORT=8787
VOLUME ["/app/data"]
EXPOSE 8787
CMD ["node", "dist-server/index.js"]
