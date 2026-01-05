import { getDriver } from "@/server/graph/client";

const VECTOR_INDEX_NAME = "hadith_embedding_index";
const VECTOR_DIMENSIONS = 1536;
const VECTOR_SIMILARITY = "cosine";

let vectorIndexReady: Promise<void> | null = null;

export function getVectorIndexName() {
  return VECTOR_INDEX_NAME;
}

export async function ensureVectorIndex(): Promise<void> {
  if (!vectorIndexReady) {
    vectorIndexReady = (async () => {
      const session = getDriver().session();
      try {
        await session.run(
          `
            CREATE VECTOR INDEX ${VECTOR_INDEX_NAME} IF NOT EXISTS
            FOR (h:Hadith) ON (h.embedding)
            OPTIONS {
              indexConfig: {
                \`vector.dimensions\`: ${VECTOR_DIMENSIONS},
                \`vector.similarity_function\`: '${VECTOR_SIMILARITY}'
              }
            }
          `,
        );
      } catch (error) {
        console.warn("[graph] Unable to ensure vector index", error);
      } finally {
        await session.close();
      }
    })();
  }
  return vectorIndexReady;
}
