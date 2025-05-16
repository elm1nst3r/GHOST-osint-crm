# File: backend/Dockerfile
# This Dockerfile is for building the backend Node.js/Express.js application.

# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# These files describe your project and its dependencies.
COPY package*.json ./

# Install app dependencies
# Using "npm ci" is generally recommended for CI/CD environments as it installs
# exact versions from package-lock.json and is faster.
# For local development, "npm install" is also fine.
RUN npm ci
# If you were using yarn:
# COPY yarn.lock ./
# RUN yarn install --frozen-lockfile

# Bundle app source
COPY . .

# Your app binds to port 3001 (or whatever you set in server.js), so expose it
EXPOSE 3001

# Define the command to run your app using CMD
# This will run "node server.js"
CMD [ "node", "server.js" ]
