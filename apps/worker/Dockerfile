FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/worker/package*.json ./apps/worker/
RUN npm install
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@geomonitor/shared
COPY apps/worker ./apps/worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
CMD ["npm", "run", "start", "--workspace=@geomonitor/worker"]
