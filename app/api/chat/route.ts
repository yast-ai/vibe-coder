import { NextRequest } from 'next/server';
import { getSandbox } from '@/lib/sandbox-manager';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start processing in the background
  (async () => {
    try {
      const { messages, sandboxId } = await req.json();
      
      if (!messages || !Array.isArray(messages)) {
        throw new Error('Invalid messages format');
      }

      if (!sandboxId) {
        throw new Error('No sandbox ID provided');
      }

      // Get the sandbox from the centralized manager
      const vercelSandbox = getSandbox(sandboxId);
      if (!vercelSandbox) {
        throw new Error(`Sandbox with ID ${sandboxId} not found. This can happen if the function instance was recycled. Make sure to call /api/sandbox/keep-alive periodically to keep the sandbox reference in memory.`);
      }

      console.log('🤖 [Chat API] Streaming from Claude Agent Server inside sandbox...');
      console.log('🤖 [Chat API] User message:', messages[messages.length - 1]?.content);

      // Get the Claude Agent Server URL (exposed on port 4000)
      const claudeServerUrl = vercelSandbox.domain(4000);
      const chatEndpoint = `${claudeServerUrl}/chat`;
      
      console.log('🤖 [Chat API] Fetching from:', chatEndpoint);

      // Fetch from the Claude Agent Server with streaming
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error(`Claude Agent Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Claude Agent Server');
      }

      console.log('🤖 [Chat API] Streaming response from Claude Agent Server...');

      // Stream the response chunk by chunk
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('🤖 [Chat API] ✅ Stream complete');
          break;
        }

        // Decode and forward the chunk immediately
        const chunk = decoder.decode(value, { stream: true });
        await writer.write(encoder.encode(chunk));
      }

    } catch (error) {
      console.error('❌ [Chat API] Error:', error);
      
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`
        )
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

