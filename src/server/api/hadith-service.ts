import { query } from "@/server/db/client";
import { HadithInsight } from "@/features/hadith/types";

export async function fetchHadithInsights(): Promise<HadithInsight[]> {
  // Placeholder implementation. Once real tables are wired, replace with actual SQL.
  console.warn("fetchHadithInsights is currently returning static data");
  return Promise.resolve([]);
}

export async function testConnection() {
  const result = await query<{ now: string }>("select now()");
  return result.rows[0]?.now;
}
