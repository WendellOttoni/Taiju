FROM oven/bun:1.4.2-alpine

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

EXPOSE 3000

CMD ["sh", "-c", "bun --filter @taiju/database db:migrate && bun apps/api/src/index.ts"]

