// Hint for Next.js; ignored when running in scripts.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop */
}
import neo4j, { Driver, Session, SessionConfig } from "neo4j-driver";

/**
 * Environment variables required:
 * - NEO4J_URI (e.g., bolt://localhost:7687 or neo4j+s://<hostname>:7687)
 * - NEO4J_USER (e.g., neo4j)
 * - NEO4J_PASSWORD (e.g., super-secret-password)
 */

declare global {
  // eslint-disable-next-line no-var
  var __riwayyaatNeo4jDriver: Driver | undefined;
}

function createDriver(): Driver {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    throw new Error(
      "[graph] Missing Neo4j configuration. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.",
    );
  }

  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

const driver: Driver = globalThis.__riwayyaatNeo4jDriver ?? createDriver();

if (process.env.NODE_ENV !== "production") {
  globalThis.__riwayyaatNeo4jDriver = driver;
}

export function getDriver(): Driver {
  return driver;
}

export function getSession(config: SessionConfig = {}): Session {
  // Default to read sessions unless caller needs write.
  return driver.session({ defaultAccessMode: neo4j.session.READ, ...config });
}

export async function closeDriver(): Promise<void> {
  await driver.close();
}
