# File: frontend/Dockerfile

# Stage 1: Build the React application (Vite)
# The build output (static files) is the same on every architecture, so it
# runs on the build machine's own platform; only the nginx stage below is
# built per target (amd64, arm64) when publishing multi-arch images.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build

# Install build dependencies that may be needed for native modules
RUN apk add --no-cache python3 make g++

# Set the working directory
WORKDIR /app

# Copy package.json AND package-lock.json first
COPY package*.json ./

# Copy configuration files
COPY vite.config.js ./

# Install dependencies using npm ci for reproducible builds
# Fall back to npm install if package-lock.json is missing
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit; else npm install --prefer-offline --no-audit; fi

# Copy the rest of the application code
COPY . .

# Build with Vite into build/. Source maps are shipped on purpose (issue #53,
# `build.sourcemap` in vite.config.js) so browser consoles show real
# component names and line numbers instead of minified frames.
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.30-alpine

# Copy the build output from the build stage to Nginx's web server directory
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]