# JunctionX2025 Front‑End

This directory contains the **React + TypeScript** front‑end for the
JunctionX2025 project. The back‑end is still powered by **Django +
Django REST Framework**, but this folder houses a standalone front‑end
built with **Vite**. The goal of this refactor is to layer a modern
single--page application on top of the existing API without altering any
of the Python/Django logic.

## What's included

The Vite scaffolding keeps things minimal and opinionated. The generated
structure looks like this:

| Path or file     | Purpose                                                                                                                                                  |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `package.json`   | Declares npm scripts and dependencies (React, TypeScript, Vite, etc.).                                                                                   |
| `tsconfig.json`  | TypeScript configuration used by both Vite and your editor.                                                                                              |
| `vite.config.ts` | Vite configuration. You can customize dev‑server settings here (e.g. configure a proxy to the Django API).                                               |
| `index.html`     | The root HTML file. Vite treats this as source code; it references the TypeScript entry point via `<script type="module" src="/src/main.tsx"></script>`. |
| `src/main.tsx`   | Entry point that mounts the `App` component into the DOM.                                                                                                |
| `src/App.tsx`    | Root React component. Replace this with your actual UI.                                                                                                  |
| `src/index.css`  | Global CSS file.                                                                                                                                         |
| `README.md`      | This document.                                                                                                                                           |

## Why Vite?

Vite is a next‑generation build tool that delivers lightning‑fast hot
module replacement (HMR). It uses native ES modules in the browser and
bundles your code with Rollup for production. Official documentation
recommends using the `create‑vite` scaffolder to bootstrap a new
project. You can run `npm create vite@latest` and follow the
prompts[\[1\]](https://vite.dev/guide/#:~:text=Scaffolding%20Your%20First%20Vite%20Project),
or specify a template directly using
`--template`[\[2\]](https://vite.dev/guide/#:~:text=%23%20npm%207%2B%2C%20extra%20double,template%20vue).

The Vite documentation notes that Node **20.19+** (or **22.12+**) is
required to run
Vite[\[3\]](https://vite.dev/guide/#:~:text=Compatibility%20Note). The
provided Docker service uses the official `node:20‑alpine` image, which
satisfies this requirement.

## Running the front‑end

### Via Docker (recommended)

Running the front‑end inside Docker means contributors don't need Node
installed locally. A `frontend` service is added to `docker‑compose.yml`
alongside your existing Django service. The service uses
`node:20‑alpine` and mounts the `frontend/` directory as a volume. A
typical configuration looks like this:

    services:
      web:
        # Existing Django service (unchanged)
        build: .
        container_name: trashPanda
        command: >
          sh -c "python backend/manage.py migrate &&
                 python backend/manage.py runserver 0.0.0.0:8000"
        ports:
          - "8000:8000"
        volumes:
          - .:/app
        environment:
          - PYTHONUNBUFFERED=1

      frontend:
        image: node:20-alpine
        working_dir: /app/frontend
        volumes:
          - ./frontend:/app/frontend
        # CHOKIDAR_USEPOLLING=true ensures file watching works in Docker on some platforms[4]
        command: sh -c "npm install && npm run dev -- --host 0.0.0.0 --port 5173"
        environment:
          - CHOKIDAR_USEPOLLING=true
        ports:
          - "5173:5173"

With this setup, running

    docker compose up --build

will start both services. The Django API will be available at
`http://localhost:8000`, and the Vite dev server will be available at
`http://localhost:5173`. You can develop the React app with hot
reloading, and any changes you make under `frontend/` will instantly
reflect in the browser.

### Running locally (optional)

If you prefer to run the front‑end without Docker, you need Node
installed (version 20 or later). In that case, do the following from the
repository root:

    cd frontend
    npm install
    npm run dev -- --host 0.0.0.0 --port 5173

### Connecting to the Django API

To call API endpoints served by Django (running on port 8000), you
should use relative paths (e.g. `fetch('/api/v1/...')`). If the React
app and the API run on different origins during development, you can
configure Vite's dev‑server proxy to forward certain paths to the
back‑end. For example, in `vite.config.ts`:

    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';

    export default defineConfig({
      plugins: [react()],
      server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
          // Proxy API requests to Django
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            // optional: remove "/api" prefix when forwarding
            // rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
      },
    });

Vite's config allows you to define proxies for development so that calls
to `/api` are forwarded to the Django
server[\[5\]](https://vite.dev/config/server-options#:~:text=js). This
approach avoids Cross‑Origin Resource Sharing (CORS) issues and keeps
your front‑end code clean.

## Scaffolding the project

To create this front‑end from scratch, use the `create‑vite` scaffolder.
From the root of your repository:

1.  **Generate the project:**

<!-- -->

    # npm 7+ requires a second double dash before template arguments
    npm create vite@latest frontend -- --template react-ts

This command downloads the Vite scaffolder and generates a `frontend/`
folder using the React + TypeScript template. You can also run
`npm create vite@latest` and choose the template
interactively[\[1\]](https://vite.dev/guide/#:~:text=Scaffolding%20Your%20First%20Vite%20Project).

1.  **Install dependencies:**

<!-- -->

    cd frontend
    npm install

1.  **Test locally:**

<!-- -->

    npm run dev -- --host 0.0.0.0 --port 5173

Vite defaults to port 5173. Passing `--host 0.0.0.0` allows access from
outside the
container[\[6\]](https://vite.dev/config/server-options#:~:text=Unless%20noted%2C%20the%20options%20in,are%20only%20applied%20to%20dev).

1.  **Integrate with Docker:**

Add the `frontend` service shown earlier to your `docker‑compose.yml`.
When you run `docker compose up`, Docker will install dependencies and
start the dev server automatically.

### Fixing "no package.json" or file mapping errors {#fixing-no-package.json-or-file-mapping-errors}

If the `node:20‑alpine` container reports `no package.json found` or
fails to run `npm install`, ensure that:

1.  **The** `frontend/` **directory exists and contains**
    `package.json`**.** Use the scaffold command above to generate it.
    Without this file, npm has nothing to install.

2.  **The** `volumes` **path in** `docker‑compose.yml` **matches your
    repository structure.** The example uses `./frontend:/app/frontend`;
    adjust the path if your repository root differs.

3.  **Permissions are correct.** Files created on the host must be
    readable by the container. On Linux/Mac this usually works out of
    the box. On Windows/WSL2, you may need to set
    `CHOKIDAR_USEPOLLING=true` to make file watching
    work[\[4\]](https://vite-plugin-ssr.com/docker#:~:text=Dev).

## Roadmap / Future Enhancements {#roadmap-future-enhancements}

This minimal setup lays the groundwork for a richer application. Ideas
for future enhancements include:

- **React Router:** Add client‑side routing with `react-router-dom` to
  handle multiple pages or nested layouts.
- **State management:** Introduce a state library such as Redux Toolkit,
  Zustand, Jotai or React Context depending on complexity.
- **Styling:** Integrate Tailwind CSS or another CSS framework. Vite's
  plugin system makes adding PostCSS or Tailwind straightforward.
- **UI Components:** Consider `shadcn/ui`, Material‑UI, Chakra UI, or
  your favourite design system for ready‑made components.
- **Next.js migration:** When ready for server‑side rendering or
  file‑based routing, migrate to Next.js. Next.js can be paired with
  Django via API endpoints or by gradually replacing parts of the stack.

Keep this document updated as the project evolves. The combination of
Django and Vite keeps a clear separation between back‑end and front‑end
responsibilities while enabling a smooth developer experience.

[\[1\]](https://vite.dev/guide/#:~:text=Scaffolding%20Your%20First%20Vite%20Project)
[\[2\]](https://vite.dev/guide/#:~:text=%23%20npm%207%2B%2C%20extra%20double,template%20vue)
[\[3\]](https://vite.dev/guide/#:~:text=Compatibility%20Note) Getting
Started \| Vite

<https://vite.dev/guide/>

[\[4\]](https://vite-plugin-ssr.com/docker#:~:text=Dev) Docker \|
vite-plugin-ssr

<https://vite-plugin-ssr.com/docker>

[\[5\]](https://vite.dev/config/server-options#:~:text=js)
[\[6\]](https://vite.dev/config/server-options#:~:text=Unless%20noted%2C%20the%20options%20in,are%20only%20applied%20to%20dev)
Server Options \| Vite

<https://vite.dev/config/server-options>
