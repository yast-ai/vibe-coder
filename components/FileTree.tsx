'use client';

import { useState, useEffect, useRef } from 'react';
import { useSandbox, FileNode } from '../context/SandboxContext';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onFileSelect: (file: string) => void;
  selectedFile: string | null;
}

function FileTreeItem({ node, level, onFileSelect, selectedFile }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(level === 0);

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node.path);
    }
  };

  const isSelected = selectedFile === node.path;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors ${
          isSelected ? 'bg-zinc-700' : 'hover:bg-zinc-800'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 text-zinc-500 transition-transform ${
              isOpen ? 'rotate-90' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {node.type === 'directory' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-blue-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-zinc-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span className="text-sm text-zinc-300">{node.name}</span>
      </div>
      {node.type === 'directory' && isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeItem
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  onFileSelect: (file: string) => void;
  selectedFile: string | null;
}

export default function FileTree({ onFileSelect, selectedFile }: FileTreeProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const { getFileTree, sandbox } = useSandbox();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!sandbox || loadedRef.current) return;

    const loadFiles = async () => {
      const tree = await getFileTree();
      setFiles(tree);
    };

    loadedRef.current = true;
    loadFiles();
  }, [sandbox]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Files</h2>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {files.length > 0 ? (
          files.map((node, index) => (
            <FileTreeItem
              key={`${node.path}-${index}`}
              node={node}
              level={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))
        ) : (
          <div className="px-4 py-2 text-sm text-zinc-500">Loading files...</div>
        )}
      </div>
    </div>
  );
}
