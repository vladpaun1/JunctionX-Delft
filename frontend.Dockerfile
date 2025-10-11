# frontend.Dockerfile
FROM node:20-alpine

# Upgrade npm inside the image so every container has npm 11+
RUN npm install -g npm@latest

# Dev working directory for Vite app
WORKDIR /app/frontend

# We do installs at runtime so mounted code always matches dependencies
# The named volume keeps node_modules persistent between runs

# Default command: install if needed, then start Vite dev server
CMD ["sh", "-lc", "test -d node_modules || npm ci || npm install; npm run dev -- --host 0.0.0.0 --port 5173"]
