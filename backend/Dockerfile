# File: backend/Dockerfile
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Create public directory for uploads
RUN mkdir -p public/uploads/logos

# Your app binds to port 3001
EXPOSE 3001

# Define the command to run your app
CMD [ "node", "server.js" ]