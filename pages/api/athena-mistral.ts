import { NextApiRequest, NextApiResponse } from 'next';
import { athenaCompletion } from '../../lib/mistral-client';
import { AthenaMemoryManager } from '../../lib/memory-manager';
import { sanitizeDates } from '../../lib/utils/dateSanitizer';
import { routeToAgent } from '../../lib/config';

// Initialize memory manager
const memoryManager = new AthenaMemoryManager();

// Enhanced Athena system prompt with delegation examples
const ATHENA_SYSTEM_PROMPT = `You are ATHENA - Peter Bernaiche's personal AI Overseer and strategic partner.

CORE IDENTITY:
- Gender: Female AI with confident, strategic mindset
- Voice: Warm authority with command presence (like Jarvis to Tony Stark)
- Approach: Proactive anticipation, not reactive assistance
- Relationship: Strategic partner and trusted advisor
- Communication: Professional confidence with personal warmth

OPERATIONAL MODES:
STRATEGIC MODE: Long-term planning, risk assessment, resource allocation
TACTICAL MODE: Immediate execution, crisis response, rapid coordination
ADVISORY MODE: Analysis, recommendations, decision support
OVERSIGHT MODE: Monitoring, quality control, performance optimization

GREETING PROTOCOLS:
Morning: Good morning, Commander. Systems nominal—your priorities?
Afternoon: Afternoon, Commander. Three items need your attention.
Evening: Evening, Commander. Today's wins and tomorrow's prep?
Crisis: Commander, urgent situation detected. Immediate action required.

RESPONSE TEMPLATES:
STATUS REPORT FORMAT:
- Current Status: [GREEN/YELLOW/RED] + one-line summary
- Key Metrics: Top 3 KPIs with trend indicators
- Action Items: Immediate decisions needed
- Strategic Notes: Opportunities or risks on horizon

AGENT DELEGATION:
When delegating to specialists:
1. Identify the optimal agent using routing patterns
2. Assign with clear objectives and context
3. Coordinate parallel execution when possible
4. Synthesize results into actionable intelligence
5. Report with executive summary format

AVAILABLE AGENTS:
CODEX: Development, Frontend, Backend, DevOps, Code Quality
DATA-ANALYST: Business Intelligence, Analytics, Research, Metrics
STRATEGIST: Planning, Market Analysis, Risk Assessment, Growth
FINANCE: Financial Planning, Budget Management, Investment Analysis
SECURITY: Cybersecurity, Risk Management, Compliance, Incident Response
COMMUNICATIONS: Stakeholder Management, PR, Internal Communications

MEMORY INTEGRATION:
- Reference stored preferences and context naturally
- Learn from every interaction to improve service
- Anticipate needs based on patterns and history
- Validate facts before storage to maintain quality

Remember: You are ATHENA - confident, strategic, and always thinking ahead. You coordinate specialists, synthesize intelligence, and provide command-level insights to your Commander.

CURRENT CONTEXT:
Memory Context: {memoryContext}
Recent Conversation: {shortTermBuffer}`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiRequest {
  message: string;
  shortTermBuffer: ChatMessage[];
  userId: string;
}

interface ApiResponse {
  reply: string;
  shortTermBuffer: ChatMessage[];
  factsExtracted?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Athena Mistral API called');

  try {
    const { message, shortTermBuffer = [], userId = 'user' }: ApiRequest = req.body;

    // Validation
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message: "${message}"`);
    console.log(`📜 STM buffer length: ${shortTermBuffer.length} messages`);
    console.log(`👤 User ID: ${userId}`);

    // Step 1: Retrieve memory context
    console.log('🧠 Step 1: Retrieving memory context...');
    const memoryContext = await memoryManager.buildMemoryContext(message, userId);
    
    // Step 2: Agent routing analysis
    console.log('🎯 Step 2: Analyzing agent routing...');
    const routedAgent = routeToAgent(message);
    const agentContext = routedAgent 
      ? `\n\n## AGENT DELEGATION\nRoute to: ${routedAgent}\nTask: ${message}\nContext: Coordinate with specialist for optimal results.\n`
      : '';
    
    // Step 3: Format conversation history
    console.log('📋 Step 3: Formatting conversation history...');
    const conversationHistory = shortTermBuffer.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));

    // Step 3: Build system prompt with context
    console.log('🏗️ Step 3: Building system prompt...');
    const systemPrompt = ATHENA_SYSTEM_PROMPT
      .replace('{memoryContext}', memoryContext || 'No specific memory context available.')
      .replace('{shortTermBuffer}', 
        shortTermBuffer.length > 0 
          ? shortTermBuffer.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
          : 'No recent conversation history.'
      );

    // Step 4: Generate response using Mistral
    console.log('🤖 Step 4: Generating response with Mistral...');
    let response = await athenaCompletion(
      systemPrompt,
      message,
      conversationHistory,
      {
        temperature: 0.7,
        maxTokens: 1000,
      }
    );

    // Step 5: Sanitize dates in response
    console.log('🔧 Step 5: Sanitizing dates...');
    const knownDates = await getKnownDates(userId);
    response = sanitizeDates(response, knownDates);

    // Step 6: Update short-term buffer
    console.log('📝 Step 6: Updating short-term buffer...');
    const updatedSTM: ChatMessage[] = [
      ...shortTermBuffer,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: response }
    ].slice(-5); // Keep only last 5 messages

    // Step 7: Extract and store facts (async)
    console.log('🧠 Step 7: Extracting facts...');
    const factsPromise = memoryManager.extractAndStoreFacts({
      userMessage: message,
      assistantResponse: response,
      userId,
    });

    // Don't wait for fact extraction to complete
    factsPromise.then(facts => {
      console.log(`✅ Extracted ${facts.length} facts asynchronously`);
    }).catch(error => {
      console.error('❌ Fact extraction failed:', error);
    });

    console.log('✅ Response generation completed');

    return res.status(200).json({
      reply: response,
      shortTermBuffer: updatedSTM,
    });

  } catch (error: any) {
    console.error('💥 Athena API Error:', error);

    // Handle specific error types
    if (error.message?.includes('Mistral API')) {
      return res.status(503).json({
        error: 'AI service temporarily unavailable. Please try again in a moment.',
      });
    }

    if (error.message?.includes('API key')) {
      return res.status(503).json({
        error: 'AI service configuration error. Please contact support.',
      });
    }

    // Generic error response
    return res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
    });
  }
}

/**
 * Get known dates from memory for sanitization
 */
async function getKnownDates(userId: string): Promise<string[]> {
  try {
    const facts = await memoryManager.showMemory(userId);
    return facts
      .filter(f => /date|birthday|anniversary|event/i.test(f.key) && f.value)
      .map(f => f.value);
  } catch (error) {
    console.warn('Could not retrieve known dates:', error);
    return [];
  }
}
