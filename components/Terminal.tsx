'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useSandbox } from '../context/SandboxContext';

export default function Terminal() {
  const [isExpanded, setIsExpanded] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCommandRef = useRef<string>('');
  const { sandbox, executeCommand } = useSandbox();

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !sandbox) return;

    let mounted = true;

    async function initTerminal() {
      if (!terminalRef.current || !sandbox || !mounted) return;

      // Initialize xterm
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0d0d0d',
          foreground: '#d4d4d8',
          cursor: '#3b82f6',
          black: '#000000',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#d4d4d8',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#fafafa',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      
      if (terminalRef.current) {
        xterm.open(terminalRef.current);
        fitAddon.fit();
      }
      
      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Write welcome message and show prompt
      xterm.writeln('Welcome to Vercel Sandbox Terminal');
      xterm.writeln('Type commands and press Enter to execute');
      xterm.writeln('');
      xterm.write('$ ');

      // Handle user input
      xterm.onData(async (data) => {
        if (!mounted) return;

        // Handle Enter key
        if (data === '\r') {
          xterm.write('\r\n');
          
          const command = currentCommandRef.current.trim();
          if (command) {
            try {
              // Execute command via API
              const response = await fetch('/api/sandbox/terminal', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  sandboxId: sandbox.id,
                  input: command,
                }),
              });

              if (response.ok) {
                const responseData = await response.json();
                if (responseData.output) {
                  // Write output and ensure proper formatting
                  xterm.write(responseData.output);
                  // Add newline if output doesn't end with one
                  if (!responseData.output.endsWith('\n') && !responseData.output.endsWith('\r\n')) {
                    xterm.write('\r\n');
                  }
                }
              } else {
                xterm.write('Error executing command\r\n');
              }
            } catch (error) {
              console.error('Failed to execute command:', error);
              xterm.write(`Error: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
            }
          }

          currentCommandRef.current = '';
          xterm.write('$ ');
          return;
        }

        // Handle Backspace
        if (data === '\u007F') {
          if (currentCommandRef.current.length > 0) {
            currentCommandRef.current = currentCommandRef.current.slice(0, -1);
            xterm.write('\b \b');
          }
          return;
        }

        // Handle Ctrl+C
        if (data === '\u0003') {
          currentCommandRef.current = '';
          xterm.write('^C\r\n$ ');
          return;
        }

        // Regular character input
        currentCommandRef.current += data;
        xterm.write(data);
      });
    }

    initTerminal();

    return () => {
      mounted = false;
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [sandbox, executeCommand]);

  useEffect(() => {
    // Resize terminal when expanded/collapsed
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 0);
    }
  }, [isExpanded]);

  return (
    <div className={`flex flex-col bg-[#0d0d0d] ${isExpanded ? 'h-96' : 'h-48'}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121212] px-4 py-2">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium text-white">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div ref={terminalRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}

