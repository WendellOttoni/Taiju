import { createAuthUserRepository, createDatabase } from "@taiju/database";
import { serve } from "bun";
import { createApp } from "./app";
import { createAuthService } from "./auth";
import { loadEnvironment } from "./config/environment";

const environment = loadEnvironment(process.env);

const auth =
  environment.DATABASE_URL !== undefined &&
  environment.AUTH_JWT_SECRET !== undefined
    ? createAuthService(
        createAuthUserRepository(createDatabase(environment.DATABASE_URL)),
        environment.AUTH_JWT_SECRET,
      )
    : undefined;

const app = createApp({ auth });

serve({
  fetch: app.fetch,
  port: environment.PORT,
});

console.info(`Taiju API listening on http://localhost:${environment.PORT}`);
