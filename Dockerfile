FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json .prettierrc.json eslint.config.mjs ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8080
LABEL org.opencontainers.image.title="ito-bot" \
      org.opencontainers.image.description="Discord ito game bot" \
      org.opencontainers.image.source="https://github.com/AlexanderGG-0520/Ito-Bot"
ENTRYPOINT ["node", "dist/src/index.js"]
