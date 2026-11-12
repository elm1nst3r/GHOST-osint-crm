# File: backend/Dockerfile
FROM node:26-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# "published" for the release images (set by the publish workflow), "source"
# for a local build: the update dialog shows the matching commands.
ARG GHOST_BUILD=source
ENV GHOST_BUILD=${GHOST_BUILD}

# Install su-exec for user switching in entrypoint
RUN apk add --no-cache su-exec

# Create public directory for uploads
RUN mkdir -p public/uploads/logos data/files

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Your app binds to port 3001
EXPOSE 3001

# Use entrypoint to handle permissions before starting app
ENTRYPOINT ["docker-entrypoint.sh"]

# Define the command to run your app (passed to entrypoint as arguments)
CMD ["su-exec", "nodejs", "node", "server.js"]