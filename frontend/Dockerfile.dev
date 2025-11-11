# frontend.Dockerfile
FROM node:20-alpine

RUN npm install -g npm@latest
WORKDIR /app/frontend

COPY scripts/docker/frontend-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh
RUN chmod +x /usr/local/bin/frontend-entrypoint.sh

CMD ["frontend-entrypoint.sh"]
