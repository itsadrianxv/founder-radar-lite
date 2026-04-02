FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY test ./test

CMD ["node", "src/cli.js", "smoke"]
