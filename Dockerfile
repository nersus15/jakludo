# ==========================================
# STAGE 1: Build Client (Vite + React)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package manifest
COPY package*.json ./

# Install seluruh dependensi (sesuai package-lock) termasuk devDependencies untuk build
RUN npm ci

# Salin seluruh source code proyek
COPY . .

# Jalankan Vite build (menghasilkan folder dist)
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5172

# Salin package manifest
COPY package*.json ./

# Install hanya dependensi produksi (tanpa devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Ambil hasil build frontend statis dari builder
COPY --from=builder /app/dist ./dist

# Salin backend server (tanpa file test)
COPY server/ ./server/
RUN rm -f server/*.test.js

# Siapkan direktori data JSON milik user non-root `node` (uid 1000)
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
USER node

# Expose port aplikasi
EXPOSE 5172

# Healthcheck otomatis Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5172/health || exit 1

# Jalankan server JakLudo
CMD ["node", "server/index.js"]

