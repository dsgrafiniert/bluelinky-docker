FROM node:current-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install 
COPY config.json.example ./
COPY server.js ./

EXPOSE 8080
CMD [ "NODE_ENV=production", "node", "server.js" ]