FROM oven/bun:1.4.2-alpine AS build

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile && bun --filter @taiju/web build

FROM caddy:2.10-alpine

COPY deployment/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv

EXPOSE 80 443

