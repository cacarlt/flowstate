FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache tzdata
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
RUN npx tsc

COPY --from=client-build /app/client/dist ./client-dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

VOLUME /app/data

CMD ["node", "dist/index.js"]
