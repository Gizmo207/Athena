import { Document } from "@langchain/core/documents";
import { getChromaStore } from "../vectorstore/chroma";

// Get a singleton Chroma store instance
const memoryStorePromise = getChromaStore();

/**
 * Stores a conversation summary in vector memory.
 */
export async function storeConversationSummary(userId: string, summary: string, timestamp: string) {
  const store = await memoryStorePromise;
  const doc = new Document({
    pageContent: `Conversation on ${timestamp}: ${summary}`,
    metadata: { userId, timestamp, type: "summary" },
  });
  await store.addDocuments([doc]);
}

/**
 * Retrieves the most relevant summaries based on current query.
 */
export async function getRecentSummaries(userId: string, k = 3): Promise<string[]> {
  const store = await memoryStorePromise;
  const results = await store.similaritySearch(`Recent conversations with ${userId}`, k);
  return results.map((doc) => doc.pageContent);
}
