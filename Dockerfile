FROM node:20-alpine AS builder

WORKDIR /app

# Use alternative mirrors and install OpenSSL for Prisma and build tools for native modules
RUN echo "https://mirror.csclub.uwaterloo.ca/alpine/v3.20/main" > /etc/apk/repositories && \
    echo "https://mirror.csclub.uwaterloo.ca/alpine/v3.20/community" >> /etc/apk/repositories && \
    apk add --no-cache openssl libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Use alternative mirrors and install OpenSSL for Prisma, build tools for bcrypt, and netcat for health checks
RUN echo "https://mirror.csclub.uwaterloo.ca/alpine/v3.20/main" > /etc/apk/repositories && \
    echo "https://mirror.csclub.uwaterloo.ca/alpine/v3.20/community" >> /etc/apk/repositories && \
    apk add --no-cache openssl libc6-compat python3 make g++ netcat-openbsd

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Install tsx globally for seeding
RUN npm install -g tsx

# Generate Prisma client
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directory
RUN mkdir -p /app/data

# Expose ports
EXPOSE 3000 3001

ENTRYPOINT ["/entrypoint.sh"]
