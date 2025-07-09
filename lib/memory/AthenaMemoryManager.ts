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
      console.log(`🧠 Extracting facts from: "${message}"`);
      
      // Use LLM to extract facts in JSON format - more specific prompt
      const extractionPrompt = `Extract factual information about the user from this message. Only extract concrete facts like preferences, possessions, personal details, etc. Respond ONLY in valid JSON array format like this: [{"type":"possession","key":"motorcycle","value":"2009 Harley Davidson Street Bob with red powder-coat and T143 crate motor"},{"type":"preference","key":"favoriteColor","value":"red"}]

Message to analyze: "${message}"

JSON array:`;
      
      const llmResult = await this.llm.call(extractionPrompt);
      console.log(`🤖 LLM extraction result: ${llmResult.trim()}`);
      
      let facts: Array<{ type: string; key: string; value: string }>; 
      try {
        // Try to extract JSON from the response
        const jsonMatch = llmResult.match(/\[.*\]/s);
        const jsonStr = jsonMatch ? jsonMatch[0] : llmResult.trim();
        facts = JSON.parse(jsonStr);
        console.log(`✅ Parsed ${facts.length} facts:`, facts);
      } catch (e) {
        console.warn('❌ Fact extraction failed, not valid JSON:', llmResult);
        return;
      }
      
      if (!Array.isArray(facts) || facts.length === 0) {
        console.log('ℹ️ No facts found in message');
        return;
      }

      // Store each fact as a separate document (simplified - no immediate deduplication)
      for (const fact of facts) {
        if (!fact.key || !fact.value) continue;
        
        console.log(`💾 Storing fact: ${fact.key} = ${fact.value}`);
        
        // Store new fact directly
        const doc = new Document({
          pageContent: `${fact.key}: ${fact.value}`,
          metadata: {
            userId,
            timestamp: new Date().toISOString(),
            type: fact.type,
            key: fact.key,
            value: fact.value,
            originMessage: message,
            documentType: 'fact', // Mark as fact vs conversation
          },
        });
        
        await store.addDocuments([doc]);
        console.log(`✅ Stored fact: ${fact.key} = ${fact.value}`);
      }
    } catch (error: any) {
      console.error('❌ Error adding fact to memory store:', error);
    }
  }

  /**
   * Retrieve top-k related facts for a query.
   */
  async getRelevantFacts(query: string, k = 5): Promise<{ key: string; value: string; type: string; timestamp: string; originMessage: string }[]> {
    try {
      const store = await this.storePromise;
      console.log(`🔍 Searching for facts related to: "${query}"`);
      
      // Search for facts only (not conversations)
      const docs = await store.similaritySearch(query, k, { documentType: 'fact' });
      console.log(`📚 Found ${docs.length} relevant facts`);
      
      const facts = docs.map(doc => ({
        key: doc.metadata?.key || '',
        value: doc.metadata?.value || '',
        type: doc.metadata?.type || '',
        timestamp: doc.metadata?.timestamp || '',
        originMessage: doc.metadata?.originMessage || '',
      })).filter(f => f.key && f.value); // Only return facts with content
      
      console.log('🎯 Relevant facts:', facts); // Always log relevant facts for debug
      return facts;
    } catch (error: any) {
      console.error('❌ Error retrieving relevant facts:', error);
      return [];
    }
  }

  /**
   * Get formatted memory context for injection into prompts.
   */
  async getMemoryContext(query: string, k = 5): Promise<string> {
    try {
      const facts = await this.getRelevantFacts(query, k);
      if (!facts.length) {
        console.log('ℹ️ No memory context found for query');
        return '';
      }
      
      const context = facts.map(f => `• ${f.key}: ${f.value} (${f.type}, stored ${new Date(f.timestamp).toLocaleDateString()})`).join('\n');
      console.log(`📝 Memory context built:\n${context}`);
      return context;
    } catch (error: any) {
      console.error('❌ Error building memory context:', error);
      return '';
    }
  }

  /**
   * Returns all stored facts for review.
   */
  async showMemory(): Promise<Array<{ key: string; value: string; type: string; timestamp: string; originMessage: string }>> {
    try {
      const store = await this.storePromise;
      const docs = await store.similaritySearch('', 100, { documentType: 'fact' });
      console.log(`📊 Total facts in memory: ${docs.length}`);
      
      const facts = docs.map(doc => ({
        key: doc.metadata?.key || '',
        value: doc.metadata?.value || '',
        type: doc.metadata?.type || '',
        timestamp: doc.metadata?.timestamp || '',
        originMessage: doc.metadata?.originMessage || '',
      })).filter(f => f.key && f.value);
      
      console.log('All stored facts:', facts);
      return facts;
    } catch (error: any) {
      console.error('❌ Error retrieving all memory:', error);
      return [];
    }
  }
}
