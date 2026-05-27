# =============================================
# ZBCNUSDT Sinyal Dashboard - Docker
# =============================================
# Build:   docker build -t zbcnusdt .
# Run:     docker run -d -p 3456:3456 --name zbcnusdt zbcnusdt
# =============================================

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app

# Sadece production için gerekli dosyalar
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Sinyal geçmişi için data/ dizini oluştur
RUN mkdir -p /app/data

# Port
EXPOSE 3456

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3456/api/health || exit 1

# Başlatma
CMD ["node", "server.js"]
