'use client';

import { useState, useRef, useEffect } from 'react';
import { useSandbox } from '@/context/SandboxContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolUse?: { tool: string; input: any }[];
}

export default function Chat() {
  const { sandbox } = useSandbox();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I can help you build applications. I have access to the Sandbox filesystem and can read, write, search files, run commands, and more. What would you like to create or modify?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentResponse]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !sandbox) return;
    
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setCurrentResponse('');

    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Stream response from API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          sandboxId: sandbox.id,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let toolsUsed: { tool: string; input: any }[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'text') {
                assistantMessage += data.content;
                setCurrentResponse(assistantMessage);
              } else if (data.type === 'tool') {
                toolsUsed.push({ tool: data.tool, input: data.input });
                console.log('🔧 Tool used:', data.tool, data.input);
              } else if (data.type === 'tool_result') {
                console.log('✅ Tool result:', data.content);
              } else if (data.type === 'done') {
                // Finalize the message
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: assistantMessage || 'Done!',
                  toolUse: toolsUsed.length > 0 ? toolsUsed : undefined,
                }]);
                setCurrentResponse('');
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }

      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      }]);
    } finally {
      setIsLoading(false);
      setCurrentResponse('');
      abortControllerRef.current = null;
    }
  };

  const handleNewChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I can help you build applications. I have access to the Sandbox filesystem and can read, write, search files, run commands, and more. What would you like to create or modify?',
    }]);
    setInput('');
    setCurrentResponse('');
  };

  return (
    <div className="flex h-screen flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <h1 className="text-lg font-semibold text-white">Bolt</h1>
        </div>
        <button 
          onClick={handleNewChat}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
                  <span className="text-sm font-bold text-white">B</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-100'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.toolUse && message.toolUse.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.toolUse.map((tool, i) => (
                      <span 
                        key={i}
                        className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded"
                        title={JSON.stringify(tool.input, null, 2)}
                      >
                        🔧 {tool.tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-700">
                  <span className="text-sm font-bold text-white">U</span>
                </div>
              )}
            </div>
          ))}
          
          {/* Streaming response */}
          {currentResponse && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
                <span className="text-sm font-bold text-white">B</span>
              </div>
              <div className="rounded-2xl px-4 py-3 bg-zinc-800 text-zinc-100">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentResponse}</p>
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
              </div>
            </div>
          )}
          
          {/* Loading indicator */}
          {isLoading && !currentResponse && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
                <span className="text-sm font-bold text-white">B</span>
              </div>
              <div className="rounded-2xl px-4 py-3 bg-zinc-800 text-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-zinc-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-700 p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe what you want to build..."
              className="flex-1 resize-none rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !sandbox}
              className={`self-end rounded-xl px-6 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isLoading || !input.trim() || !sandbox
                  ? 'bg-zinc-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

