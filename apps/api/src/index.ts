import {
  createAuthUserRepository,
  createDatabase,
  createHistoryRepository,
  createLibraryRepository,
} from "@taiju/database";
import { SuwayomiRuntimeClient, SuwayomiSourceDirectory } from "@taiju/sources";
import { serve } from "bun";
import { createApp } from "./app";
import { createAuthService } from "./auth";
import { loadEnvironment } from "./config/environment";

const environment = loadEnvironment(process.env);

const database =
  environment.DATABASE_URL === undefined
    ? undefined
    : createDatabase(environment.DATABASE_URL);
const auth =
  database !== undefined && environment.AUTH_JWT_SECRET !== undefined
    ? createAuthService(
        createAuthUserRepository(database),
        environment.AUTH_JWT_SECRET,
      )
    : undefined;
const sources =
  environment.SUWAYOMI_URL === undefined
    ? undefined
    : new SuwayomiSourceDirectory(
        new SuwayomiRuntimeClient({
          baseUrl: environment.SUWAYOMI_URL,
          publicBaseUrl: environment.SUWAYOMI_PUBLIC_URL,
        }),
      );

const app = createApp({
  adultContentEmails: environment.ADULT_CONTENT_EMAILS,
  auth,
  history:
    database === undefined ? undefined : createHistoryRepository(database),
  library:
    database === undefined ? undefined : createLibraryRepository(database),
  sources,
});

serve({
  fetch: app.fetch,
  port: environment.PORT,
});

console.info(`Taiju API listening on http://localhost:${environment.PORT}`);
