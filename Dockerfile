# Use a small Node 22 base image to keep the runtime footprint low.
FROM node:22-alpine

# Build inside /app so copied paths match the project layout.
WORKDIR /app

# Install dependencies before copying the full source tree for better layer caching.
COPY package*.json ./
RUN npm install

# Copy the repository into the image after dependencies are available.
COPY . .

# Compile the TypeScript source into dist/ for production startup.
RUN npm run build

# Expose the API port used by docker-compose and the benchmark harness.
EXPOSE 8080

# Production mode keeps the runtime behavior aligned with the deployed image.
ENV NODE_ENV=production
# Run migrations before starting the compiled server entry point.
CMD ["sh", "-c", "npm run migrate:prod && node dist/server.js"]
