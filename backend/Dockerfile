FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/placeholder npx prisma generate

COPY scripts ./scripts
COPY src ./src
EXPOSE 8787
CMD ["sh", "-c", "npm run db:push && npm run db:parity && node src/server.mjs"]
