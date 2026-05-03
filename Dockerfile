FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --include=optional
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx tsc

FROM node:20-alpine
ARG VERSION=dev
ENV FLOWSTATE_VERSION=$VERSION
LABEL org.opencontainers.image.revision=$VERSION
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.title="FlowState"
LABEL org.opencontainers.image.source="https://github.com/cacarlt/flowstate"

RUN apk add --no-cache tzdata
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=server-build /app/dist ./dist

COPY --from=client-build /app/client/dist ./client-dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/config', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/index.js"]
