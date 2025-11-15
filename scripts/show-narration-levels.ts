import { getClient } from "@/server/db/client";

async function main() {
  const client = await getClient();
  try {
    const result = await client.query("SELECT id, name_en FROM narration_level ORDER BY id");
    console.log(result.rows);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
