# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package metadata
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy the rest of the source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the TypeScript code
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package metadata
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled source and scripts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Set environment to production
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
