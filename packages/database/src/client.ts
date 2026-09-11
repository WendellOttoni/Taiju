import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type TaijuDatabase = ReturnType<typeof drizzle>;

export function parseDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw new Error(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );

  return value;
}

export function createDatabase(connectionString: string): TaijuDatabase {
  const client = postgres(parseDatabaseUrl(connectionString), {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 10,
  });
  return drizzle({ client });
}
