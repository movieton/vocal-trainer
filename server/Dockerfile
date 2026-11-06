FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --silent
COPY index.mjs .
USER node
EXPOSE 8787
CMD ["node", "--no-warnings", "index.mjs"]
