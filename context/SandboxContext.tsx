'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

// Define our own sandbox type for the context (not the @vercel/sandbox Sandbox class)
interface SandboxInstance {
  id: string;
  url: string;
  claudeUrl?: string;
}

interface SandboxContextType {
  sandbox: SandboxInstance | null;
  isBooting: boolean;
  isInstalling: boolean;
  isRunning: boolean;
  url: string | null;
  files: Map<string, string>;
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, content: string) => Promise<void>;
  getFileTree: () => Promise<FileNode[]>;
  invalidateFileTreeCache: () => void;
  fileChangeSubscribers: Map<string, Set<(content: string) => void>>;
  subscribeToFileChanges: (path: string, callback: (content: string) => void) => () => void;
  executeCommand: (command: string) => Promise<void>;
  previewRefreshTrigger: number;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

const SandboxContext = createContext<SandboxContextType | null>(null);

export function useSandbox() {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error('useSandbox must be used within SandboxProvider');
  }
  return context;
}

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [sandbox, setSandbox] = useState<SandboxInstance | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const initStartedRef = useRef(false);
  const fileChangeSubscribersRef = useRef<Map<string, Set<(content: string) => void>>>(new Map());
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);

  // File tree caching with TTL to prevent repeated API calls
  const fileTreeCacheRef = useRef<{
    tree: FileNode[] | null;
    timestamp: number;
    ttl: number;
  }>({
    tree: null,
    timestamp: 0,
    ttl: 30000, // Cache for 3 seconds
  });

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initStartedRef.current) {
      return;
    }
    initStartedRef.current = true;

    async function initSandbox() {
      try {
        setIsBooting(true);
        console.log('Creating Vercel Sandbox...');
        
        // Create sandbox via API route
        const response = await fetch('/api/sandbox/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to create sandbox');
        }

        const data = await response.json();
        const sandboxInstance = data.sandbox;
        
        setSandbox(sandboxInstance);
        console.log('Sandbox created:', sandboxInstance);

        setIsBooting(false);

        // Wait for sandbox to be ready with health checks
        console.log('Waiting for sandbox to initialize...');
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!isReady && attempts < maxAttempts) {
          try {
            const healthResponse = await fetch('/api/sandbox/health', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sandboxId: sandboxInstance.id,
              }),
            });

            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              
              // Check both isReady and isAccessible
              if (healthData.isReady && healthData.isAccessible) {
                isReady = true;
                console.log('Sandbox is ready and preview is accessible!');
              } else if (healthData.error) {
                console.error('Sandbox initialization error:', healthData.error);
              } else if (healthData.isReady && !healthData.isAccessible) {
                console.log('Sandbox initialized, waiting for dev server... (' + (attempts + 1) + '/' + maxAttempts + ')', healthData.accessError);
              } else {
                console.log('Sandbox initializing... (' + (attempts + 1) + '/' + maxAttempts + ')');
              }
            }
          } catch (error) {
            console.log('Health check failed, retrying...', error);
          }

          if (!isReady) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
          }
        }

        if (!isReady && attempts >= maxAttempts) {
          console.warn('Sandbox initialization timeout - proceeding anyway');
        }

        setIsInstalling(false);

        // Set the URL
        if (sandboxInstance.url) {
          setUrl(sandboxInstance.url);
          console.log('Dev server URL:', sandboxInstance.url);
        }

        setIsRunning(true);

      } catch (error) {
        console.error('Error initializing Sandbox:', error);
        setIsBooting(false);
        setIsInstalling(false);
        initStartedRef.current = false; // Allow retry on error
      }
    }

    initSandbox();
  }, []);

  const readFile = useCallback(
    async (path: string): Promise<string | null> => {
      if (!sandbox) {
        console.error('readFile: No sandbox instance available');
        return null;
      }
      try {
        console.log(`readFile: Requesting ${path} from sandbox ${sandbox.id}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          const response = await fetch('/api/sandbox/file/read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sandboxId: sandbox.id,
              path,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log(`readFile: Response status ${response.status} for ${path}`);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`readFile: Failed to read file ${path}:`, response.status, errorData);
            return null;
          }

          const data = await response.json();
          console.log(`readFile: Successfully read ${path} (${data.content?.length || 0} bytes)`);
          return data.content;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError') {
              console.error(`readFile: Request timeout (30s) for ${path}`);
            } else {
              console.error(`readFile: Fetch error for ${path}:`, fetchError.message);
            }
          }
          return null;
        }
      } catch (error) {
        console.error(`Error reading file ${path}:`, error);
        return null;
      }
    },
    [sandbox]
  );

  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!sandbox) return;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          const response = await fetch('/api/sandbox/file/write', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sandboxId: sandbox.id,
              path,
              content,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error('Failed to write file');
          }

          setFiles(prev => new Map(prev).set(path, content));
          console.log(`File saved: ${path}`);
          
          // Notify subscribers of the change
          const subscribers = fileChangeSubscribersRef.current.get(path);
          if (subscribers) {
            subscribers.forEach(callback => callback(content));
          }
          
          // Trigger preview refresh
          setPreviewRefreshTrigger(prev => prev + 1);

        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError') {
              console.error(`writeFile: Request timeout (30s) for ${path}`);
            } else {
              console.error(`writeFile: Error for ${path}:`, fetchError.message);
            }
          }
        }
      } catch (error) {
        console.error(`Error writing file ${path}:`, error);
      }
    },
    [sandbox]
  );

  const subscribeToFileChanges = useCallback((path: string, callback: (content: string) => void) => {
    if (!fileChangeSubscribersRef.current.has(path)) {
      fileChangeSubscribersRef.current.set(path, new Set());
    }
    
    fileChangeSubscribersRef.current.get(path)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      fileChangeSubscribersRef.current.get(path)?.delete(callback);
      if (fileChangeSubscribersRef.current.get(path)?.size === 0) {
        fileChangeSubscribersRef.current.delete(path);
      }
    };
  }, []);

  const getFileTree = useCallback(async (): Promise<FileNode[]> => {
    if (!sandbox) return [];
    
    // Check if we have a valid cached result
    const now = Date.now();
    const cache = fileTreeCacheRef.current;
    
    if (cache.tree !== null && (now - cache.timestamp) < cache.ttl) {
      console.log('getFileTree: Using cached tree (age: ' + (now - cache.timestamp) + 'ms)');
      return cache.tree;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        console.log('getFileTree: Fetching fresh tree from API');
        const response = await fetch('/api/sandbox/file/tree', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sandboxId: sandbox.id,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to get file tree');
        }

        const data = await response.json();
        
        // Update cache
        cache.tree = data.tree;
        cache.timestamp = now;
        
        return data.tree;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.error('getFileTree: Request timeout (30s)');
          } else {
            console.error('getFileTree: Error:', fetchError.message);
          }
        }
        // Return stale cache if available
        return cache.tree || [];
      }
    } catch (error) {
      console.error('Error getting file tree:', error);
      return [];
    }
  }, [sandbox]);

  const invalidateFileTreeCache = useCallback(() => {
    fileTreeCacheRef.current.tree = null;
    fileTreeCacheRef.current.timestamp = 0;
    console.log('invalidateFileTreeCache: Cache invalidated');
  }, []);

  const executeCommand = useCallback(
    async (command: string): Promise<void> => {
      if (!sandbox) return;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for commands
        
        try {
          await fetch('/api/sandbox/command', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sandboxId: sandbox.id,
              command,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError') {
              console.error(`executeCommand: Request timeout (60s) for command: ${command}`);
            } else {
              console.error(`executeCommand: Error for command "${command}":`, fetchError.message);
            }
          }
        }
      } catch (error) {
        console.error('Error executing command:', error);
      }
    },
    [sandbox]
  );

  const value: SandboxContextType = {
    sandbox,
    isBooting,
    isInstalling,
    isRunning,
    url,
    files,
    readFile,
    writeFile,
    getFileTree,
    invalidateFileTreeCache,
    fileChangeSubscribers: fileChangeSubscribersRef.current,
    subscribeToFileChanges,
    executeCommand,
    previewRefreshTrigger,
  };

  return (
    <SandboxContext.Provider value={value}>
      {children}
    </SandboxContext.Provider>
  );
}

export type { FileNode };

