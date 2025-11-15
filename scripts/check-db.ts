import { healthcheck } from "../src/server/db/client";

async function main() {
  const ok = await healthcheck();
  if (!ok) {
    console.error("Database connection failed");
    process.exit(1);
  }
  console.log("Database connection successful");
  process.exit(0);
}

main().catch((error) => {
  console.error("Unexpected error while checking DB", error);
  process.exit(1);
});
