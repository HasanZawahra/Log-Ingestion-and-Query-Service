FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate:prod && node dist/server.js"]
