'use client';

import { useState, useEffect, useRef } from 'react';
import { useSandbox } from '../context/SandboxContext';

interface CodeEditorProps {
  selectedFile: string | null;
}

export default function CodeEditor({ selectedFile }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExternalChanges, setHasExternalChanges] = useState(false);
  const { readFile, writeFile, subscribeToFileChanges } = useSandbox();
  const previousFileRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  const hasUnsavedChanges = content !== originalContent;

  // Subscribe to file changes and handle refresh
  const handleExternalFileChange = (newContent: string) => {
    // Only mark as external change if user hasn't made local changes
    if (!hasUnsavedChanges) {
      setContent(newContent);
      setOriginalContent(newContent);
      setHasExternalChanges(false);
    } else {
      // User has local changes, show that external changes are available
      setHasExternalChanges(true);
    }
  };

  const handleRefresh = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    const fileContent = await readFile(selectedFile);
    if (fileContent !== null) {
      setContent(fileContent);
      setOriginalContent(fileContent);
    }
    setHasExternalChanges(false);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!selectedFile) {
      setContent('');
      setOriginalContent('');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Only load if file changed
    if (selectedFile !== previousFileRef.current) {
      async function loadFile() {
        if (!selectedFile) return;
        
        console.log(`Loading file: ${selectedFile}`);
        setIsLoading(true);
        
        try {
          const fileContent = await readFile(selectedFile);
          if (fileContent !== null) {
            console.log(`Successfully loaded file: ${selectedFile}`);
            setContent(fileContent);
            setOriginalContent(fileContent);
          } else {
            console.error(`Failed to load file: ${selectedFile} - returned null`);
            setContent('');
            setOriginalContent('');
          }
        } catch (error) {
          console.error(`Error loading file ${selectedFile}:`, error);
          setContent('');
          setOriginalContent('');
        } finally {
          setIsLoading(false);
        }
      }

      loadFile();
      previousFileRef.current = selectedFile;
      
      // Unsubscribe from previous file
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      // Subscribe to changes for this file
      unsubscribeRef.current = subscribeToFileChanges(selectedFile, handleExternalFileChange);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    await writeFile(selectedFile, content);
    setOriginalContent(content);
    setHasExternalChanges(false);
    setIsSaving(false);
  };

  // Keyboard shortcut: Ctrl+S or Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, selectedFile, hasUnsavedChanges]);

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto mb-3 h-12 w-12 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-zinc-500">Select a file to edit</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1a1a]">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#1a1a1a] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">{selectedFile}</span>
          {hasUnsavedChanges && (
            <span className="flex h-2 w-2 rounded-full bg-blue-500" title="Unsaved changes" />
          )}
          {hasExternalChanges && (
            <span className="text-xs text-yellow-500" title="File changed externally">⚠️ modified</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasExternalChanges && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 rounded-lg border border-yellow-600 bg-yellow-900 px-2 py-1.5 text-xs text-yellow-200 transition-colors hover:bg-yellow-800"
              title="File was modified externally. Click to refresh."
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 5V3a1 1 0 01-1-1zm.008 9a1 1 0 011.858.166A5.002 5.002 0 0014.001 15v2a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 11 1.885-.666A5.002 5.002 0 0014.001 15v2a1 1 0 11 2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01 1.885-.666A5.002 5.002 0 0014.001 15v2a1 1 0 11 2 0v-2.101z" clipRule="evenodd" />
              </svg>
              Refresh
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              hasUnsavedChanges && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                </svg>
                Save {hasUnsavedChanges && '(Ctrl+S)'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="select-none border-r border-zinc-800 bg-[#0d0d0d] px-4 py-4 text-right font-mono text-sm leading-6 text-zinc-600">
          {content.split('\n').map((_, index) => (
            <div key={index + 1}>{index + 1}</div>
          ))}
        </div>

        {/* Code textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 resize-none bg-[#1a1a1a] p-4 font-mono text-sm leading-6 text-zinc-300 outline-none"
          spellCheck={false}
          placeholder="Start editing..."
        />
      </div>
    </div>
  );
}

