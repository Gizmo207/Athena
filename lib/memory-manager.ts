import { chatCompletion, simpleCompletion } from './mistral-client';
import { 
  storeMemoryFact, 
  searchMemoryFacts, 
  getAllMemoryFacts,
  initializeQdrantCollection,
  MemoryFact
} from './qdrant-client';
import { generateEmbedding } from './embedding-client';
import { CONFIG } from './config';
import { v4 as uuidv4 } from 'uuid';

// Fact extraction prompt template
const FACT_EXTRACT_PROMPT = `You are an expert at extracting structured facts from conversations. 

Extract key facts from this conversation turn as a JSON array. Only include facts that are:
- Specific and memorable
- About the user's preferences, possessions, experiences, or personal details
- Not general knowledge or common facts

Format each fact as: {"type": "preference|fact|context|personal_detail|possession", "key": "brief_identifier", "value": "detailed_content"}

Ty pes:
- preference: User likes/dislikes, opinions, choices
- fact: Specific information about user's life, work, experiences
- context: Situational information, current state
- personal_detail: Name, age, location, relationships
- possession: Things the user owns or has

User message: {userMessage}
Assistant response: {assistantResponse}

Return only the JSON array, no other text:`;

interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  userId: string;
}

interface MemoryContext {
  facts: MemoryFact[];
  contextText: string;
}

/**
 * Enhanced Memory Manager for Athena using Qdrant + Mistral
 */
export class AthenaMemoryManager {
  private initialized = false;

  constructor() {
    this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      try {
        await initializeQdrantCollection();
        this.initialized = true;
        console.log('✅ AthenaMemoryManager initialized');
      } catch (error) {
        console.error('❌ Failed to initialize AthenaMemoryManager:', error);
        throw error;
      }
    }
  }

  /**
   * Validate fact structure
   */
  private validateFact(fact: any): boolean {
    if (!fact || typeof fact !== 'object') return false;
    
    // Required fields
    if (!fact.type || !fact.key || !fact.value) return false;
    
    // Type validation
    const validTypes = ['preference', 'fact', 'context', 'personal_detail', 'possession'];
    if (!validTypes.includes(fact.type)) return false;
    
    // Content validation
    if (typeof fact.key !== 'string' || typeof fact.value !== 'string') return false;
    
    // Length validation
    if (fact.value.length < 5 || fact.value.length > 500) return false;
    
    return true;
  }

  /**
   * Calculate fact quality score
   */
  private calculateFactQuality(factText: string): number {
    const length = Math.min(factText.length / 100, 1);
    const uniqueness = this.calculateUniqueness(factText);
    const actionability = this.containsActionableInfo(factText);
    
    return (length * 0.3) + (uniqueness * 0.4) + (actionability * 0.3);
  }

  /**
   * Calculate text uniqueness score
   */
  private calculateUniqueness(text: string): number {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = words.filter(word => !commonWords.includes(word));
    return Math.min(uniqueWords.length / words.length, 1);
  }

  /**
   * Check if text contains actionable information
   */
  private containsActionableInfo(text: string): number {
    const actionablePatterns = [
      /prefers?|likes?|dislikes?|wants?|needs?/i,
      /owns?|has|possesses?/i,
      /works? at|employed by|position/i,
      /lives? in|located|address/i,
      /birthday|anniversary|date/i,
      /goal|objective|plan/i
    ];
    
    const matches = actionablePatterns.filter(pattern => pattern.test(text));
    return Math.min(matches.length / 3, 1);
  }

  /**
   * Check if fact is low value
   */
  private isLowValueFact(text: string): boolean {
    const lowValuePatterns = [
      /^(thank you|thanks|hello|hi|goodbye|bye|yes|no|ok|okay|alright|sure|fine)\.?$/i,
      /^(what|how|when|where|why)\s*\?$/i,
      /^.{1,4}$/,  // Very short responses
    ];
    
    return lowValuePatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Extract and store facts from a conversation turn
   */
  async extractAndStoreFacts(turn: ConversationTurn): Promise<MemoryFact[]> {
    try {
      console.log('🧠 Extracting facts from conversation turn...');
      
      const prompt = FACT_EXTRACT_PROMPT
        .replace('{userMessage}', turn.userMessage)
        .replace('{assistantResponse}', turn.assistantResponse);

      const response = await simpleCompletion(prompt, {
        temperature: 0.1, // Low temperature for consistent extraction
        maxTokens: 500,
      });

      // Parse the JSON response
      let extractedFacts: any[] = [];
      try {
        extractedFacts = JSON.parse(response);
      } catch (parseError) {
        console.warn('⚠️ Failed to parse fact extraction response:', response);
        return [];
      }

      if (!Array.isArray(extractedFacts)) {
        console.warn('⚠️ Fact extraction did not return an array');
        return [];
      }

      // Convert to MemoryFact objects and store
      const memoryFacts: MemoryFact[] = [];
      for (const fact of extractedFacts) {
        // Validate fact structure
        if (!this.validateFact(fact)) {
          console.warn('⚠️ Invalid fact structure, skipping:', fact);
          continue;
        }

        // Check fact quality
        const factText = `${fact.key}: ${fact.value}`;
        const qualityScore = this.calculateFactQuality(factText);
        
        if (qualityScore < 0.3) {
          console.warn('⚠️ Low quality fact, skipping:', fact);
          continue;
        }

        // Check for low-value patterns
        if (this.isLowValueFact(factText)) {
          console.warn('⚠️ Low value fact, skipping:', fact);
          continue;
        }

        const memoryFact: MemoryFact = {
          id: uuidv4(),
          type: fact.type,
          key: fact.key,
          value: fact.value,
          timestamp: new Date().toISOString(),
          originMessage: turn.userMessage,
          userId: turn.userId,
        };

        // Generate embedding for the fact
        const embedding = await generateEmbedding(factText);
        
        // Store in Qdrant
        await storeMemoryFact(memoryFact, embedding);
        memoryFacts.push(memoryFact);
      }

      console.log(`💾 Extracted and stored ${memoryFacts.length} facts`);
      return memoryFacts;
    } catch (error) {
      console.error('❌ Failed to extract and store facts:', error);
      return [];
    }
  }

  /**
   * Retrieve relevant memory context for a query
   */
  async getMemoryContext(query: string, userId: string, limit: number = 10): Promise<MemoryContext> {
    try {
      console.log(`🔍 Retrieving memory context for: "${query}"`);
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
      
      // Search for relevant facts
      const searchResults = await searchMemoryFacts(queryEmbedding, userId, limit);
      
      if (searchResults.length === 0) {
        console.log('ℹ️ No relevant memory context found');
        return {
          facts: [],
          contextText: '',
        };
      }

      // Format facts into context text
      const contextParts: string[] = [];
      const facts = searchResults.map(result => result.fact);
      
      facts.forEach(fact => {
        contextParts.push(`• ${fact.key}: ${fact.value} (${fact.type}, stored ${new Date(fact.timestamp).toLocaleDateString()})`);
      });

      const contextText = contextParts.join('\n');
      
      console.log(`📚 Retrieved ${facts.length} relevant facts for context`);
      return {
        facts,
        contextText,
      };
    } catch (error) {
      console.error('❌ Failed to retrieve memory context:', error);
      return {
        facts: [],
        contextText: '',
      };
    }
  }

  /**
   * Add a fact directly (for simple fact storage)
   */
  async addFact(userId: string, message: string): Promise<void> {
    try {
      // For now, we'll extract facts from a simple conversation turn
      // where the assistant response is empty
      const turn: ConversationTurn = {
        userMessage: message,
        assistantResponse: 'Information noted.',
        userId,
      };

      await this.extractAndStoreFacts(turn);
    } catch (error) {
      console.error('❌ Failed to add fact:', error);
      throw error;
    }
  }

  /**
   * Get all stored facts for a user
   */
  async showMemory(userId: string): Promise<MemoryFact[]> {
    try {
      console.log(`📋 Retrieving all memory for user: ${userId}`);
      return await getAllMemoryFacts(userId);
    } catch (error) {
      console.error('❌ Failed to retrieve memory:', error);
      throw error;
    }
  }

  /**
   * Get memory context as formatted text (legacy compatibility)
   */
  async getMemoryContextText(query: string, userId: string = 'default'): Promise<string> {
    const context = await this.getMemoryContext(query, userId);
    return context.contextText;
  }

  /**
   * Build comprehensive memory context from search query
   */
  async buildMemoryContext(query: string, userId: string): Promise<string> {
    try {
      const context = await this.getMemoryContext(query, userId, 15);
      
      if (context.facts.length === 0) {
        return '';
      }

      // Group facts by type
      const groupedFacts: Record<string, MemoryFact[]> = {};
      context.facts.forEach(fact => {
        if (!groupedFacts[fact.type]) {
          groupedFacts[fact.type] = [];
        }
        groupedFacts[fact.type].push(fact);
      });

      // Format by type
      const sections: string[] = [];
      
      if (groupedFacts.personal_detail) {
        sections.push('👤 Personal Details:');
        groupedFacts.personal_detail.forEach(fact => {
          sections.push(`   • ${fact.key}: ${fact.value}`);
        });
      }
      
      if (groupedFacts.preference) {
        sections.push('❤️ Preferences:');
        groupedFacts.preference.forEach(fact => {
          sections.push(`   • ${fact.key}: ${fact.value}`);
        });
      }
      
      if (groupedFacts.possession) {
        sections.push('🏠 Possessions:');
        groupedFacts.possession.forEach(fact => {
          sections.push(`   • ${fact.key}: ${fact.value}`);
        });
      }
      
      if (groupedFacts.fact) {
        sections.push('📝 Facts:');
        groupedFacts.fact.forEach(fact => {
          sections.push(`   • ${fact.key}: ${fact.value}`);
        });
      }
      
      if (groupedFacts.context) {
        sections.push('🔄 Context:');
        groupedFacts.context.forEach(fact => {
          sections.push(`   • ${fact.key}: ${fact.value}`);
        });
      }

      return sections.join('\n');
    } catch (error) {
      console.error('❌ Failed to build memory context:', error);
      return '';
    }
  }

  /**
   * Test buffer overflow handling
   */
  async testBufferOverflow(messages: Array<{ userMessage: string; assistantResponse: string; userId: string }>): Promise<any> {
    const results = [];
    
    for (const message of messages) {
      try {
        const facts = await this.extractAndStoreFacts(message);
        results.push({
          success: true,
          factsExtracted: facts.length,
          message: message.userMessage.substring(0, 50) + '...'
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: message.userMessage.substring(0, 50) + '...'
        });
      }
    }
    
    return {
      totalProcessed: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results.slice(-10) // Keep last 10 for debugging
    };
  }

  /**
   * Test memory pruning functionality
   */
  async testMemoryPruning(userId: string): Promise<any> {
    try {
      // Get all facts before pruning
      const allFactsBefore = await getAllMemoryFacts(userId);
      
      // Simulate pruning (this would normally be based on age, relevance, etc.)
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const factsToKeep = allFactsBefore.filter(fact => 
        new Date(fact.timestamp) > cutoffDate
      );
      
      return {
        totalFactsBefore: allFactsBefore.length,
        factsAfterPruning: factsToKeep.length,
        prunedCount: allFactsBefore.length - factsToKeep.length,
        pruningCriteria: 'Facts older than 7 days',
        oldestFact: allFactsBefore.length > 0 ? 
          new Date(Math.min(...allFactsBefore.map(f => new Date(f.timestamp).getTime()))).toISOString() : 
          null,
        newestFact: allFactsBefore.length > 0 ? 
          new Date(Math.max(...allFactsBefore.map(f => new Date(f.timestamp).getTime()))).toISOString() : 
          null
      };
    } catch (error) {
      throw new Error(`Memory pruning test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AthenaMemoryManager;
