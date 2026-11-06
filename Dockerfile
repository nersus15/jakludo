# ==========================================
# STAGE 1: Build Client (Vite + React)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package manifest
COPY package*.json ./

# Install seluruh dependensi termasuk devDependencies untuk build
RUN npm install

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
ENV PORT=3001

# Salin package manifest
COPY package*.json ./

# Install hanya dependensi produksi (tanpa devDependencies)
RUN npm install --omit=dev && npm cache clean --force

# Ambil hasil build frontend statis dari builder
COPY --from=builder /app/dist ./dist

# Salin backend server
COPY server/ ./server/

# Siapkan direktori persistensi data JSON dan atur hak akses untuk non-root user
RUN mkdir -p /app/server/data && chown -R node:node /app

# Gunakan non-root user untuk keamanan maksimal di server Ubuntu
USER node

# Expose port aplikasi
EXPOSE 3001

# Healthcheck otomatis Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Jalankan server JakLudo
CMD ["node", "server/index.js"]

