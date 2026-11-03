# syntax=docker/dockerfile:1
# Imagen de la API de aalcuadrado. Funciona en amd64 y en arm64 (Raspberry Pi 4/5):
# todas las dependencias de producción son JavaScript puro, sin compilar nada nativo.

ARG NODE_VERSION=24

# ---------- 1. Compilar ----------
FROM node:${NODE_VERSION}-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- 2. Dependencias de producción ----------
FROM node:${NODE_VERSION}-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=optional deja fuera better-sqlite3: TypeORM lo declara opcional y solo lo usan las pruebas.
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

# ---------- 3. Imagen final ----------
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads

# package.json hace falta en ejecución: declara "type": "module".
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=dependencias /app/node_modules ./node_modules
COPY --chown=node:node --from=compilacion /app/dist ./dist
COPY --chown=node:node public ./public

# Carpeta de fotos: se monta como volumen. Se crea aquí para que el volumen sea del usuario `node`.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 3000

# El panel es la única página pública que no depende de la base de datos.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/panel/" || exit 1

CMD ["node", "dist/main.js"]
