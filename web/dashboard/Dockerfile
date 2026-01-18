FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_ANALYTICS_URL
ENV NEXT_PUBLIC_ANALYTICS_URL=${NEXT_PUBLIC_ANALYTICS_URL}

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next

RUN mkdir -p ./public
RUN if [ -d /app/public ]; then cp -a /app/public/. ./public/; fi

EXPOSE 3000
CMD ["npm", "run", "start"]
