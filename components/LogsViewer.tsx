'use client';

import { useEffect, useRef, useState } from 'react';
import { useSandbox } from '@/context/SandboxContext';

export default function LogsViewer() {
  const { sandbox } = useSandbox();
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sandbox?.id) return;

    // Connect to Claude Agent Server logs endpoint via proxy
    const connectToLogs = async () => {
      try {
        abortControllerRef.current = new AbortController();
        
        console.log('📡 Connecting to Claude Agent logs via proxy...');
        
        const response = await fetch('/api/sandbox/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sandboxId: sandbox.id,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to connect to logs: ${response.statusText}`);
        }

        setIsConnected(true);
        console.log('✅ Connected to Claude Agent logs');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('📡 Log stream ended');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'log' && data.message) {
                  setLogs(prev => [...prev, data.message]);
                }
              } catch (err) {
                // Ignore JSON parse errors
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('📡 Log stream cancelled');
        } else {
          console.error('❌ Error connecting to logs:', error);
          setIsConnected(false);
        }
      }
    };

    connectToLogs();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sandbox?.id]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-zinc-300">Claude Agent Logs</span>
        </div>
        <button
          onClick={handleClear}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Clear
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-zinc-500">
            {isConnected ? 'Waiting for logs...' : 'Connecting to Claude Agent Server...'}
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`whitespace-pre-wrap ${
                log.includes('[ERROR]')
                  ? 'text-red-400'
                  : log.includes('[INFO]')
                  ? 'text-zinc-300'
                  : 'text-zinc-400'
              }`}
            >
              {log}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

