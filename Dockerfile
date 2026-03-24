# Stage 1: Install Node dependencies
FROM node:22-alpine AS node-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Build Next.js
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=node-deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production runner (Python base for converter, Node.js installed)
FROM python:3.11-slim AS runner

# Install system dependencies: Java (for MPXJ), Node.js, supervisord
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk-headless \
    wget \
    curl \
    supervisor \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Install Python converter dependencies
WORKDIR /converter
COPY converter/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download MPXJ JARs as fallback
RUN mkdir -p /converter/jars && \
    wget -q -P /converter/jars/ \
    https://repo1.maven.org/maven2/net/sf/mpxj/mpxj/10.12.0/mpxj-10.12.0.jar \
    https://repo1.maven.org/maven2/org/glassfish/jakarta.json/2.0.1/jakarta.json-2.0.1.jar \
    https://repo1.maven.org/maven2/jakarta/json/jakarta.json-api/2.1.3/jakarta.json-api-2.1.3.jar

COPY converter/app.py .

# Set up Next.js app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/omniplan.conf

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
