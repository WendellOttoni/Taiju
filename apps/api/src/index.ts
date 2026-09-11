import { serve } from "bun";
import { app } from "./app";
import { loadEnvironment } from "./config/environment";

const environment = loadEnvironment(process.env);

serve({
  fetch: app.fetch,
  port: environment.PORT,
});

console.info(`Taiju API listening on http://localhost:${environment.PORT}`);
