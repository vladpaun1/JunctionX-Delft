# frontend.Dockerfile
FROM node:20-alpine

RUN npm install -g npm@latest
WORKDIR /app/frontend

# If node_modules doesn't exist OR is empty, install deps, then start dev
CMD ["sh", "-lc", "if [ ! -d node_modules ] || [ -z \"$(ls -A node_modules 2>/dev/null)\" ]; then npm ci || npm install; fi; npm run dev -- --host 0.0.0.0 --port 5173"]
