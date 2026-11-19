FROM grafana/k6:latest AS k6

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN CI=true pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=k6 /usr/bin/k6 /usr/local/bin/k6
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
