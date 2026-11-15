# StressLab — Consola de pruebas de estrés

Aplicación universal para someter a estrés **cualquier URL** — APIs o páginas web, públicas o de tu red privada (intranet) — con un **tablero en vivo** de métricas, gráficas e historial.

## Características

- **Universal**: apunta a cualquier `http(s)://` — pública, `localhost` o red privada. Las peticiones salen del servidor, nunca del navegador.
- **Motor k6**: los escenarios se compilan a scripts k6 y se ejecutan automáticamente. k6 se detecta solo: usa el binario local si existe, o **Docker** (`grafana/k6`) como respaldo. En modo Docker, `localhost` se reescribe a `host.docker.internal` automáticamente.
- **Tablero en vivo**: RPS, latencia media, tasa de errores, VUs, requests y tiempo — vía **SSE** (Server-Sent Events) con gráficas en tiempo real y consola de k6.
- **Escenarios configurables**: tipo API (método, headers, body) o WEB (página), rampa de usuarios o tasa constante (req/s), think time, status esperado, TLS inseguro (certificados autofirmados) y umbrales p95/p99/errores.
- **Umbrales evaluados**: cada corrida termina con chips ✓/✕ de cada umbral configurado.
- **Historial persistente**: corridas con resumen (requests, p95, p99, errores, duración).
- **Informes descargables**: al terminar una corrida puedes descargar un PDF con el objetivo, resultado explicado, hallazgos y oportunidades de mejora.
- **Base de datos intercambiable**: SQLite por defecto; cambia a MySQL o PostgreSQL solo con variables de entorno.

## Arquitectura

```
├── server/                # Backend MVC (Express + TypeScript)
│   ├── migrations/        # Migraciones Knex (ESM)
│   └── src/
│       ├── config/        # env + conexión a BD (knex)
│       ├── routes/        # Rutas HTTP
│       ├── controllers/   # Validación de entrada → servicios
│       ├── services/      # K6Service (script + proceso), RunService (ciclo de vida +
│       │                  #   agregación de métricas), SseHub (broadcast en vivo)
│       ├── models/        # Tipos, schema Zod, repositories (Scenario/Run)
│       └── middleware/    # Errores HTTP
├── frontend/              # React 19 + Tailwind v4 + Vite
│   └── src/
│       ├── components/    # ui/ (Panel, Button, Badge, Field, Modal…),
│       │                  # charts/ (LiveChart con recharts), layout/, dashboard/,
│       │                  # scenario/, history/
│       ├── hooks/         # useHealth, useScenarios, useRunStream (SSE),
│       │                  # useRunHistory, useToast
│       ├── lib/           # api (fetch tipado), format, types
│       └── pages/         # Dashboard, Scenarios, History
├── tests/k6/              # Smoke test k6 clásico
├── Dockerfile             # Multi-stage + binario de k6 incluido
└── docker-compose.yml     # app (con k6) + profile "stress" para el smoke clásico
```

## Inicio rápido

### Opción A — Docker (todo incluido)

```bash
docker compose up --build
# → http://localhost:3000
```

### Opción B — Desarrollo local

Requisitos: Node 22+, Docker corriendo (para k6) o [k6 local](https://k6.io/docs/get-started/installation/).

```bash
pnpm install
pnpm dev          # API :3000 + Vite :5173 (usa http://localhost:5173)
```

### Verificación completa (typecheck + build)

```bash
pnpm test
```

## Configuración de base de datos

Copia `.env.example` a `.env` y ajusta:

```bash
# SQLite (default, cero configuración)
DB_CLIENT=better-sqlite3
DB_FILE=data/stresslab.db

# MySQL
DB_CLIENT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=secreto
DB_NAME=stresslab

# PostgreSQL
DB_CLIENT=pg
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secreto
DB_NAME=stresslab
```

Las migraciones se ejecutan automáticamente al arrancar.

## Uso

1. Abre el **Tablero**, elige un escenario (hay dos ejemplos al primer arranque) y pulsa **Iniciar prueba**.
2. Mira las métricas, gráficas y la consola de k6 en tiempo real.
3. Al terminar, revisa el resumen con p95/p99 y el resultado de los umbrales.
4. Descarga el informe completo desde el detalle de la corrida terminada.
5. Crea tus propios escenarios en **Escenarios** (URL, método, headers, carga, umbrales) y consulta el **Historial**.

Consulta la [guía completa de uso](docs/guia-uso-stresslab.md) para ejemplos de
URLs públicas y privadas, pruebas de usuarios concurrentes, interpretación de
métricas y alcance de la fase 2.

### Notas sobre URLs privadas

- Con k6 **local**, usa la URL tal cual (`http://192.168.1.10:8080/api`, `http://mi-intranet.local/`).
- Con k6 en **Docker**, `localhost`/`127.0.0.1` se traducen automáticamente a `host.docker.internal`; las IPs privadas y hostnames de red funcionan directamente (el contenedor usa la red del host).

### k6 manual (opcional)

```bash
pnpm stress       # smoke test vía Docker contra /api/health
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio, k6 y base de datos |
| GET/POST | `/api/scenarios` | Listar / crear escenarios |
| GET/PUT/DELETE | `/api/scenarios/:id` | Leer / actualizar / eliminar |
| GET/POST | `/api/runs` | Historial / iniciar corrida `{ scenarioId }` |
| GET | `/api/runs/active` | Corrida activa + métricas en vivo |
| POST | `/api/runs/stop` | Detener la corrida activa |
| GET | `/api/runs/:id` | Detalle de corrida |
| GET | `/api/runs/:id/report` | Descargar informe PDF explicado |
| GET | `/api/runs/stream` | SSE: `status`, `metrics`, `log` |
