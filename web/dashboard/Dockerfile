FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_ANALYTICS_URL
ENV NEXT_PUBLIC_ANALYTICS_URL=${NEXT_PUBLIC_ANALYTICS_URL}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./ 2>/dev/null || true

EXPOSE 3000
CMD ["npm", "run", "start"]
