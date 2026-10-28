FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
RUN npm install
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@geomonitor/shared
COPY apps/api ./apps/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@geomonitor/api"]
