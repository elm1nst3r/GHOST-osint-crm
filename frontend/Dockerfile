# File: frontend/Dockerfile

# Stage 1: Build the React application
FROM node:18-alpine AS build

# Set the working directory
WORKDIR /app

# Copy package.json AND package-lock.json first
# This allows Docker to cache the npm install step if these files haven't changed
COPY package*.json ./

# Copy Tailwind and PostCSS configuration files BEFORE npm install
# This ensures that npm install can correctly resolve any dependencies
# that might be affected by these configurations (though less common for these specific files).
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies. We are using 'npm install' as 'npm ci' was causing issues.
# 'npm install' will also generate a package-lock.json if one isn't copied or is invalid.
RUN npm install

# Copy the rest of the application code
# This will overwrite the config files copied earlier if they changed, which is fine.
# The main thing is that node_modules was installed with them present.
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.25-alpine

# Copy the build output from the build stage to Nginx's web server directory
COPY --from=build /app/build /usr/share/nginx/html

# Optional: Copy a custom Nginx configuration if you have one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (Nginx default)
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
