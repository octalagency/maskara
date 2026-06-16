FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build && test -f dist/main.js

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/
COPY scripts ./scripts/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Migrations + seed need prisma CLI and ts-node at runtime
RUN npm install prisma@6.1.0 ts-node --save-dev

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
