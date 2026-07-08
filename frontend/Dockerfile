# File: frontend/Dockerfile

# Stage 1: Build the React application
FROM node:18-alpine AS build

# Install build dependencies that may be needed for native modules
RUN apk add --no-cache python3 make g++

# Set the working directory
WORKDIR /app

# Copy package.json AND package-lock.json first
COPY package*.json ./

# Copy configuration files
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies using npm ci for reproducible builds
# Fall back to npm install if package-lock.json is missing
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit; else npm install --prefer-offline --no-audit; fi

# Copy the rest of the application code
COPY . .

# Build the application with production environment.
# Source maps are shipped on purpose (issue #53) so browser consoles show
# real component names and line numbers instead of minified frames.
ENV GENERATE_SOURCEMAP=true
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.25-alpine

# Copy the build output from the build stage to Nginx's web server directory
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]