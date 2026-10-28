FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web/package*.json ./apps/web/
RUN npm install
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@geomonitor/shared
COPY apps/web ./apps/web
RUN npm run build --workspace=@geomonitor/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@geomonitor/web"]
