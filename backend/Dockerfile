FROM node:22-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O ./prisma/global-bundle.pem
RUN npm ci && DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/placeholder npx prisma generate

COPY backend/scripts ./scripts
COPY backend/src ./src
COPY backend/assets ./assets
COPY db-export/full_schema.sql /db-export/full_schema.sql
EXPOSE 8787
CMD ["node", "src/server.mjs"]
