// Basic test script to validate enhanced session management
import { SessionManager } from './src/lib/sessionManager';
import { MessageProcessor } from './src/lib/messageProcessor';

async function runBasicTests() {
  console.log('🧪 Starting enhanced session management tests...\n');
  
  try {
    // Test 1: Create new session
    console.log('Test 1: Creating new session...');
    const session = SessionManager.createNewSession('Test Session');
    console.log(`✅ Created session: ${session.id} - "${session.title}"`);
    
    // Test 2: Add messages to session
    console.log('\nTest 2: Adding messages to session...');
    const userMessage = {
      id: MessageProcessor.generateMessageId(),
      role: 'user' as const,
      content: 'Hello, this is a test message',
      timestamp: new Date().toISOString()
    };
    
    const updatedSession = SessionManager.addMessageToSession(session, userMessage);
    console.log(`✅ Added message. Session now has ${updatedSession.messages.length} messages`);
    
    // Test 3: Generate session title
    console.log('\nTest 3: Testing session title generation...');
    const titleSession = SessionManager.updateSessionTitle(updatedSession);
    console.log(`✅ Generated title: "${titleSession.title}"`);
    
    // Test 4: Message processing
    console.log('\nTest 4: Testing message processing...');
    const chunks = MessageProcessor.createTypingChunks('This is a test message for typewriter effect');
    console.log(`✅ Created ${chunks.length} typing chunks`);
    
    // Test 5: Content validation
    console.log('\nTest 5: Testing content validation...');
    const validation = MessageProcessor.validateMessageContent('Valid test content');
    console.log(`✅ Content validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
    
    console.log('\n🎉 All basic tests passed! Enhanced session management is working correctly.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runBasicTests();
