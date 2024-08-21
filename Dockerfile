# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /khang/backend-nest

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install 

RUN npm i -g @nestjs/cli@9.4.2

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN npm run build

# Start the server using the production build
CMD [ "node", "dist/main.js" ]