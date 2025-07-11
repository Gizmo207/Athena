export interface MessageChunk {
  content: string;
  isComplete: boolean;
  timestamp: number;
}

export interface ProcessingOptions {
  stripMarkdown?: boolean;
  chunkSize?: number;
  typewriterSpeed?: number;
}

export class MessageProcessor {
  private static readonly DEFAULT_CHUNK_SIZE = 3;
  private static readonly DEFAULT_TYPEWRITER_SPEED = 30;
  
  static stripMarkdown(content: string): string {
    return content
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold and italic
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Clean up multiple newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
  
  static createTypingChunks(
    content: string,
    options: ProcessingOptions = {}
  ): MessageChunk[] {
    const {
      stripMarkdown = false,
      chunkSize = this.DEFAULT_CHUNK_SIZE,
      typewriterSpeed = this.DEFAULT_TYPEWRITER_SPEED
    } = options;
    
    const processedContent = stripMarkdown ? this.stripMarkdown(content) : content;
    const chunks: MessageChunk[] = [];
    let currentChunk = '';
    
    // Split by characters but respect word boundaries
    const words = processedContent.split(' ');
    let charCount = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWithSpace = i === 0 ? word : ` ${word}`;
      
      if (charCount + wordWithSpace.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk,
          isComplete: false,
          timestamp: Date.now()
        });
        currentChunk = word;
        charCount = word.length;
      } else {
        currentChunk += wordWithSpace;
        charCount += wordWithSpace.length;
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk,
        isComplete: true,
        timestamp: Date.now()
      });
    }
    
    return chunks;
  }
  
  static async processStreamingResponse(
    response: ReadableStream<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete: (fullContent: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const reader = response.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete(fullContent);
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              onComplete(fullContent);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore JSON parse errors for streaming data
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Streaming error'));
    } finally {
      reader.releaseLock();
    }
  }
  
  static formatMessageForDisplay(content: string, role: 'user' | 'assistant' | 'system'): string {
    if (role === 'user' || role === 'system') {
      return content.trim();
    }
    
    // For assistant messages, ensure proper markdown formatting
    return content
      .trim()
      // Ensure code blocks have proper spacing
      .replace(/```/g, '\n```')
      .replace(/\n\n```/g, '\n```')
      // Clean up excessive newlines
      .replace(/\n{3,}/g, '\n\n');
  }
  
  static extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ language: string; code: string }> = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    
    return codeBlocks;
  }
  
  static estimateTokenCount(content: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }
  
  static truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;
    
    // Try to truncate at sentence boundary
    const truncated = content.slice(0, maxChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxChars * 0.8) {
      return truncated.slice(0, lastSentenceEnd + 1);
    }
    
    // Fallback to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
  }
  
  static validateMessageContent(content: string): { isValid: boolean; error?: string } {
    if (!content || typeof content !== 'string') {
      return { isValid: false, error: 'Content must be a non-empty string' };
    }
    
    if (content.trim().length === 0) {
      return { isValid: false, error: 'Content cannot be empty or only whitespace' };
    }
    
    if (content.length > 100000) {
      return { isValid: false, error: 'Content exceeds maximum length (100,000 characters)' };
    }
    
    return { isValid: true };
  }
  
  static sanitizeInput(input: string): string {
    return input
      .trim()
      // Remove potentially dangerous characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Limit consecutive newlines
      .replace(/\n{5,}/g, '\n\n\n\n');
  }
  
  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  static calculateTypingDuration(content: string, speed: number = 30): number {
    // Speed is characters per second
    return Math.max(1000, (content.length / speed) * 1000);
  }
}
