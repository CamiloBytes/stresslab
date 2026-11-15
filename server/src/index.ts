import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { initDatabase } from "./config/db.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";
import { detectK6 } from "./services/k6.service.js";
import { runRepository } from "./models/run.repository.js";
import { seedExamples } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

async function bootstrap(): Promise<void> {
  await initDatabase();
  await runRepository.markInterrupted();
  await seedExamples();

  const k6 = await detectK6(true);

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", apiRouter);

  app.use(express.static(frontendDist));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });

  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`[stresslab] API en http://localhost:${env.port}`);
    console.log(`[stresslab] Base de datos: ${env.dbClient}`);
    console.log(
      k6.available
        ? `[stresslab] k6: ${k6.version}`
        : "[stresslab] k6 NO detectado — instálalo con: winget install grafana.k6",
    );
  });
}

bootstrap().catch((error) => {
  console.error("[stresslab] Error al iniciar:", error);
  process.exit(1);
});
