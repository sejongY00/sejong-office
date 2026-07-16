# Build frontend + backend
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

RUN npm install

COPY packages ./packages
RUN npm run build -w @sejong-office/frontend \
  && npm run build -w @sejong-office/backend

# Runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/sejong
ENV PORT=3000

COPY package.json package-lock.json* ./
COPY packages/backend/package.json packages/backend/package.json
RUN npm install --omit=dev -w @sejong-office/backend && npm cache clean --force

COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/public ./packages/backend/public
COPY --from=build /app/packages/backend/templates ./packages/backend/templates

WORKDIR /app/packages/backend
ENV TEMP_DIR=/tmp/sejong
RUN mkdir -p /tmp/sejong

EXPOSE 3000
CMD ["node", "dist/index.js"]
