FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
