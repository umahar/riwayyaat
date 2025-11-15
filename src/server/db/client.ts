import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { dbConfig } from "./config";

declare global {
  var __riwayyaatDbPool: Pool | undefined;
}

function createPool() {
  return new Pool(dbConfig);
}

const pool = globalThis.__riwayyaatDbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__riwayyaatDbPool = pool;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function healthcheck(): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch (error) {
    console.error("[db] healthcheck failed", error);
    return false;
  }
}
