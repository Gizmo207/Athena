import { Document } from '@langchain/core/documents';
import { getChromaStore } from '../vectorstore/chroma';

/**
 * Manages Athena's long-term memory using Chroma vector store.
 */
export class AthenaMemoryManager {
  private storePromise = getChromaStore();

  /**
   * Add a user fact to long-term memory.
   */
  async addFact(userId: string, fact: string) {
    const store = await this.storePromise;
    const doc = new Document({
      pageContent: fact,
      metadata: { userId, timestamp: new Date().toISOString(), type: 'fact' },
    });
    await store.addDocuments([doc]);
  }

  /**
   * Retrieve top-k related facts for a query.
   */
  async getRelevantFacts(query: string, k = 5): Promise<string[]> {
    const store = await this.storePromise;
    // similaritySearch returns Documents
    const docs = await store.similaritySearch(query, k);
    return docs.map(doc => doc.pageContent);
  }

  /**
   * Get formatted memory context for injection into prompts.
   */
  async getMemoryContext(query: string, k = 5): Promise<string> {
    const facts = await this.getRelevantFacts(query, k);
    return facts.join('\n');
  }
}
