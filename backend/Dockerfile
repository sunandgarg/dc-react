FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/placeholder npx prisma generate

COPY src ./src
EXPOSE 8787
CMD ["node", "src/server.mjs"]
