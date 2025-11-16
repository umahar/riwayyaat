import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { getClient } from "@/server/db/client";

type TableDump = {
  table: string;
  rowCount: number;
  rows: unknown[];
};

async function main() {
  const client = await getClient();
  try {
    const tablesResult = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    const tables = tablesResult.rows.map((row) => row.table_name);

    const dumps: TableDump[] = [];
    for (const table of tables) {
      // Fetch column metadata to decide on a stable ordering.
      const columnsResult = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [table],
      );
      const hasId = columnsResult.rows.some((col) => col.column_name === "id");
      const safeTable = `"${table.replace(/"/g, '""')}"`;
      const orderClause = hasId ? "ORDER BY id" : "";
      const data = await client.query(`${"SELECT * FROM "}${safeTable} ${orderClause}`);
      dumps.push({
        table,
        rowCount: data.rowCount ?? 0,
        rows: data.rows,
      });
    }

    const backup = {
      createdAt: new Date().toISOString(),
      database: process.env.PGDATABASE ?? "riwayyaat",
      tables: dumps,
    };

    const outDir = path.join(process.cwd(), "backups");
    mkdirSync(outDir, { recursive: true });
    const filename = `db-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const outPath = path.join(outDir, filename);
    writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");
    console.log(`Backup written to ${outPath}`);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error("Backup failed", error);
  process.exit(1);
});
