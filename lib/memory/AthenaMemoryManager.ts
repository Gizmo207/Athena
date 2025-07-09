import { Document } from '@langchain/core/documents';
import { getChromaStore } from '../vectorstore/chroma';
import { Ollama } from '@langchain/ollama';

/**
 * Manages Athena's long-term memory using Chroma vector store.
 */
export class AthenaMemoryManager {
  private storePromise = getChromaStore();
  private llm = new Ollama({ baseUrl: 'http://localhost:11434', model: 'mistral:instruct', temperature: 0 });

  /**
   * Add a user fact to long-term memory.
   */
  /**
   * Extracts structured facts from a message using the LLM, stores as {type, key, value, timestamp, originMessage}.
   * Deduplicates by key (updates if already exists).
   */
  async addFact(userId: string, message: string) {
    try {
      const store = await this.storePromise;
      // Use LLM to extract facts in JSON format
      const extractionPrompt = `Extract any factual statements about the user from the following message. Respond ONLY in minified JSON array format, e.g. [{"type":"preference","key":"favoriteColor","value":"blue"}]. Message: "${message}"`;
      const llmResult = await this.llm.call(extractionPrompt);
      let facts: Array<{ type: string; key: string; value: string }>; 
      try {
        facts = JSON.parse(llmResult.trim());
      } catch (e) {
        console.warn('Fact extraction failed, not valid JSON:', llmResult);
        return;
      }
      if (!Array.isArray(facts) || facts.length === 0) return;
      // Deduplicate: fetch all current facts, update if key exists
      const allDocs = await store.similaritySearch('user facts', 100);
      const existingFacts = allDocs.map(doc => doc.metadata && doc.metadata.key ? { key: doc.metadata.key, id: doc.metadata.id } : null).filter(Boolean) as any[];
      for (const fact of facts) {
        // Remove any existing fact with the same key
        for (const exist of existingFacts) {
          if (exist.key === fact.key && exist.id) {
            await store.delete({ ids: [exist.id] });
          }
        }
        // Store new/updated fact
        const doc = new Document({
          pageContent: `${fact.key}: ${fact.value}`,
          metadata: {
            userId,
            timestamp: new Date().toISOString(),
            type: fact.type,
            key: fact.key,
            value: fact.value,
            originMessage: message,
          },
        });
        await store.addDocuments([doc]);
      }
    } catch (error: any) {
      console.error('Error adding fact to memory store:', error);
    }
  }

  /**
   * Retrieve top-k related facts for a query.
   */
  async getRelevantFacts(query: string, k = 5): Promise<{ key: string; value: string; type: string; timestamp: string; originMessage: string }[]> {
    try {
      const store = await this.storePromise;
      const docs = await store.similaritySearch(query, k);
      return docs.map(doc => ({
        key: doc.metadata?.key || '',
        value: doc.metadata?.value || '',
        type: doc.metadata?.type || '',
        timestamp: doc.metadata?.timestamp || '',
        originMessage: doc.metadata?.originMessage || '',
      }));
    } catch (error: any) {
      console.error('Error retrieving relevant facts:', error);
      return [];
    }
  }

  /**
   * Get formatted memory context for injection into prompts.
   */
  async getMemoryContext(query: string, k = 5): Promise<string> {
    try {
      const facts = await this.getRelevantFacts(query, k);
      if (!facts.length) return '';
      return facts.map(f => `• ${f.key}: ${f.value} (as of ${f.timestamp})`).join('\n');
    } catch (error: any) {
      console.error('Error building memory context:', error);
      return '';
    }
  }

  /**
   * Returns all stored facts for review.
   */
  async showMemory(): Promise<Array<{ key: string; value: string; type: string; timestamp: string; originMessage: string }>> {
    try {
      const store = await this.storePromise;
      const docs = await store.similaritySearch('user facts', 100);
      return docs.map(doc => ({
        key: doc.metadata?.key || '',
        value: doc.metadata?.value || '',
        type: doc.metadata?.type || '',
        timestamp: doc.metadata?.timestamp || '',
        originMessage: doc.metadata?.originMessage || '',
      }));
    } catch (error: any) {
      console.error('Error retrieving all memory:', error);
      return [];
    }
  }
}
