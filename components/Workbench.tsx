'use client';

import { useState, useMemo } from 'react';
import FileTree from './FileTree';
import Terminal from './Terminal';
import CodeEditor from './CodeEditor';
import LogsViewer from './LogsViewer';
import { useSandbox } from '../context/SandboxContext';

type Tab = 'code' | 'preview' | 'logs';

export default function Workbench() {
  const [activeTab, setActiveTab] = useState<Tab>('code');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { url, isBooting, isInstalling, previewRefreshTrigger } = useSandbox();

  // Generate preview URL with cache-busting parameter
  const previewUrl = useMemo(() => {
    if (!url) return null;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}refresh=${previewRefreshTrigger}`;
  }, [url, previewRefreshTrigger]);

  return (
    <div className="flex h-screen flex-col bg-[#0d0d0d]">
      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-800 bg-[#121212]">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'code'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Code
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'preview'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
          Preview
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Logs
        </button>
        {(isBooting || isInstalling) && (
          <div className="ml-auto flex items-center gap-2 px-4 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {isBooting ? 'Initializing Sandbox...' : 'Ready'}
          </div>
        )}
      </div>

      {/* Content Area with Terminal Always at Bottom */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Main Content Area - Both panels rendered but hidden/shown */}
        <div className="flex flex-1 overflow-hidden">
          {/* Code Panel - Always rendered, visibility controlled */}
          <div className={`flex flex-1 ${activeTab === 'code' ? '' : 'hidden'}`}>
            {/* File Tree */}
            <div className="w-64 border-r border-zinc-800 bg-[#121212]">
              <FileTree onFileSelect={setSelectedFile} selectedFile={selectedFile} />
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor selectedFile={selectedFile} />
            </div>
          </div>

          {/* Preview Panel - Always rendered, visibility controlled */}
          <div className={`flex flex-1 ${activeTab === 'preview' ? '' : 'hidden'}`}>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-full w-full border-0 bg-white"
                title="Preview"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; xr-spatial-tracking; fullscreen"
                // sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation allow-top-navigation allow-top-navigation-by-user-activation allow-modals allow-downloads allow-popups-to-escape-sandbox allow-pointer-lock"
                referrerPolicy="no-referrer"
                style={{
                  isolation: 'isolate',
                }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-white">
                <div className="text-center">
                  <div className="mb-4">
                    <svg className="mx-auto h-16 w-16 animate-spin text-zinc-400" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-zinc-800">
                    {isBooting ? 'Initializing Vercel Sandbox...' : 'Loading Preview...'}
                  </h2>
                  <p className="mt-2 text-zinc-600">
                    This may take 10-15 seconds on first load
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Logs Panel - Always rendered, visibility controlled */}
          <div className={`flex flex-1 ${activeTab === 'logs' ? '' : 'hidden'}`}>
            <LogsViewer />
          </div>
        </div>

        {/* Terminal - Always Visible at Bottom */}
        <div className="border-t border-zinc-800">
          <Terminal />
        </div>
      </div>
    </div>
  );
}
