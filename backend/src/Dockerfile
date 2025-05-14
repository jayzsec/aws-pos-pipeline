# Use Node.js 18 Alpine as base
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose port 3000
EXPOSE 3000

# Define health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Run the application
CMD [ "node", "src/server.js" ]