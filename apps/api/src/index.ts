import { serve } from "bun";
import { app } from "./app";

const port = 3000;

serve({
  fetch: app.fetch,
  port,
});

console.info(`Taiju API listening on http://localhost:${port}`);
