import { NextApiRequest, NextApiResponse } from 'next';

interface BufferTestRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages = [] }: BufferTestRequest = req.body;
    
    console.log('🧪 Buffer test with messages:', messages);
    
    // Test buffer management logic
    const testBuffer = [...messages];
    
    // Add test messages
    testBuffer.push({ role: 'user', content: 'Test message 1' });
    testBuffer.push({ role: 'assistant', content: 'Test response 1' });
    testBuffer.push({ role: 'user', content: 'Test message 2' });
    testBuffer.push({ role: 'assistant', content: 'Test response 2' });
    
    // Apply buffer limit (5 messages)
    const limitedBuffer = testBuffer.slice(-5);
    
    return res.status(200).json({
      originalLength: testBuffer.length,
      limitedLength: limitedBuffer.length,
      originalBuffer: testBuffer,
      limitedBuffer: limitedBuffer,
      bufferManagement: {
        strategy: 'Keep last 5 messages',
        maxSize: 5,
        currentSize: limitedBuffer.length,
      },
    });
    
  } catch (error: any) {
    console.error('Buffer test error:', error);
    return res.status(500).json({ 
      error: 'Buffer test failed',
      details: error.message 
    });
  }
}
