import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Ollama API route called');

  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log('❌ Invalid message:', { message, type: typeof message });
      return res.status(400).json({ error: 'Invalid or empty message provided.' });
    }

    console.log('📦 Request message:', message);
    console.log('✅ Valid message received, calling Ollama...');

    // Call Ollama local API
    const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral:instruct',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 150,
        },
      }),
    });

    if (!ollamaResponse.ok) {
      const errorData = await ollamaResponse.text();
      console.error('❌ Ollama API error:', ollamaResponse.status, errorData);
      
      return res.status(ollamaResponse.status).json({ 
        error: `Ollama API error: ${ollamaResponse.status}. Make sure Ollama is running.` 
      });
    }

    const data = await ollamaResponse.json();
    const reply = data.message?.content || 'No response generated.';
    
    console.log('✅ Ollama success! Reply length:', reply.length);
    
    return res.status(200).json({ reply });

  } catch (error: any) {
    console.error('💥 ERROR occurred:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Check if it's a connection error (Ollama not running)
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Cannot connect to Ollama. Please make sure Ollama is running on port 11434.' 
      });
    }
    
    return res.status(500).json({ 
      error: `Server error: ${error.message}` 
    });
  }
}
