import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else {
  config();
}

const requiredEnv = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"] as const;
const missing = requiredEnv.filter((key) => process.env[key] === undefined);

if (missing.length > 0) {
  console.warn(
    `[db-config] Missing environment variables: ${missing.join(", ")}. ` +
      "Database features will be disabled until these are provided.",
  );
}

export const dbConfig = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "riwayyaat",
  user: process.env.PGUSER ?? "umairabdullah",
  password: process.env.PGPASSWORD ?? "",
  ssl:
    process.env.PGSSLMODE && process.env.PGSSLMODE !== "disable"
      ? { rejectUnauthorized: false }
      : undefined,
  application_name: process.env.PGAPPNAME ?? "riwayyaat-web",
};
