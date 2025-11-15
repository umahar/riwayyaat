import { getClient } from "@/server/db/client";

async function main() {
  const client = await getClient();
  try {
    const result = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    console.log(result.rows.map((row) => row.table_name));
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
