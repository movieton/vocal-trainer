FROM node:24-alpine
WORKDIR /app
COPY index.mjs .
USER node
EXPOSE 8787
CMD ["node", "--no-warnings", "index.mjs"]
