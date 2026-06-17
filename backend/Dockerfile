FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build
RUN ls -la dist && test -f dist/main.js

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache wget openssl

COPY package*.json ./
RUN npm install --omit=dev && npm install ts-node --save-dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma/
COPY scripts ./scripts/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN ./node_modules/.bin/prisma --version && test -f dist/main.js && test -f dist/worker.js

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
