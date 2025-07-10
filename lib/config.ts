// Critical configuration constants
export const CONFIG = {
  // Buffer Management
  MAX_BUFFER_SIZE: parseInt(process.env.MAX_BUFFER_SIZE || '5'),
  MAX_TOKENS_PER_EXCHANGE: 4000,
  
  // Context Management
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS || '8000'),
  RELEVANCE_THRESHOLD: parseFloat(process.env.RELEVANCE_THRESHOLD || '0.7'),
  MAX_CONTEXT_FACTS: parseInt(process.env.MAX_CONTEXT_FACTS || '10'),
  
  // API Configuration
  MISTRAL_RETRY_DELAYS: [1000, 2000, 4000, 8000], // Exponential backoff
  QDRANT_TIMEOUT: 10000,
  QDRANT_RETRIES: 3,
  
  // Memory Quality
  MIN_FACT_LENGTH: 5,
  MAX_FACT_LENGTH: 500,
  FACT_QUALITY_THRESHOLD: 0.6,
  
  // User Management
  DEFAULT_USER_ID: process.env.DEFAULT_USER_ID || 'peter_bernaiche',
} as const;

// Token estimation utility
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Context pruning utility
export function pruneContext(context: string, maxTokens: number = CONFIG.MAX_CONTEXT_TOKENS): string {
  const tokens = estimateTokens(context);
  if (tokens > maxTokens) {
    // Keep most recent content
    const targetLength = maxTokens * 4;
    return '...[context pruned]...\n' + context.slice(-targetLength);
  }
  return context;
}

// Buffer validation and management
export function validateAndPruneBuffer<T extends { content?: string; message?: string }>(
  buffer: T[], 
  maxSize: number = CONFIG.MAX_BUFFER_SIZE
): T[] {
  // Remove empty or invalid entries
  const validBuffer = buffer.filter(item => {
    const content = item.content || item.message || '';
    return content.trim().length > 0;
  });
  
  // Prune to max size
  return validBuffer.slice(-maxSize);
}

// Fact quality scoring
export function calculateFactQuality(fact: string): number {
  const length = Math.min(fact.length / 100, 1); // Normalize to 0-1
  const uniqueness = calculateUniqueness(fact);
  const actionability = containsActionableInfo(fact);
  
  return (length * 0.3) + (uniqueness * 0.4) + (actionability * 0.3);
}

function calculateUniqueness(text: string): number {
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = words.filter(word => !commonWords.includes(word));
  return Math.min(uniqueWords.length / words.length, 1);
}

function containsActionableInfo(text: string): number {
  const actionablePatterns = [
    /prefers?|likes?|dislikes?|wants?|needs?/i,
    /owns?|has|possesses?/i,
    /works? at|employed by|position/i,
    /lives? in|located|address/i,
    /birthday|anniversary|date/i,
    /goal|objective|plan/i
  ];
  
  const matches = actionablePatterns.filter(pattern => pattern.test(text));
  return Math.min(matches.length / 3, 1); // Normalize to 0-1
}

// Low-value pattern detection
const LOW_VALUE_PATTERNS = [
  /^(thank you|thanks|hello|hi|goodbye|bye|yes|no|ok|okay|alright|sure|fine)\.?$/i,
  /^(what|how|when|where|why)\s*\?$/i,
  /^.{1,4}$/,  // Very short responses
];

export function isLowValueFact(text: string): boolean {
  return LOW_VALUE_PATTERNS.some(pattern => pattern.test(text.trim()));
}

// Agent routing map
export const AGENT_ROUTING_MAP = {
  'code|development|programming|build|deploy|debug|software|app|website|api': 'CODEX',
  'data|analytics|metrics|report|analysis|sql|database|visualization': 'DATA-ANALYST', 
  'strategy|planning|market|competitive|business|roadmap|vision': 'STRATEGIST',
  'finance|budget|cost|revenue|financial|accounting|profit|loss': 'FINANCE',
  'security|breach|risk|compliance|vulnerability|threat|encryption': 'SECURITY',
  'communication|messaging|stakeholder|meeting|presentation|email|update|notify': 'COMMUNICATIONS',
  'project|task|management|workflow|timeline|deadline|milestone': 'PROJECT-MANAGER',
  'health|wellness|stress|work-life|mental|physical|exercise': 'WELLNESS',
  'research|investigation|analysis|study|exploration|discovery': 'RESEARCH',
  'design|ui|ux|interface|mockup|prototype|branding|graphics': 'DESIGN'
} as const;

export function routeToAgent(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const [patterns, agent] of Object.entries(AGENT_ROUTING_MAP)) {
    const regex = new RegExp(`\\b(${patterns})\\b`, 'i');
    if (regex.test(lowerQuery)) {
      return agent;
    }
  }
  
  return null; // Handle directly as Athena
}

export type AgentType = typeof AGENT_ROUTING_MAP[keyof typeof AGENT_ROUTING_MAP] | 'ATHENA';
