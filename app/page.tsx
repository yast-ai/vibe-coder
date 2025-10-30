'use client';

import dynamic from 'next/dynamic';

const Chat = dynamic(() => import('@/components/Chat'), { ssr: false });
const Workbench = dynamic(() => import('@/components/Workbench'), { ssr: false });
const ResizablePanel = dynamic(() => import('@/components/ResizablePanel'), { ssr: false });
const SandboxProvider = dynamic(
  () => import('@/context/SandboxContext').then(mod => ({ default: mod.SandboxProvider })),
  { ssr: false }
);

export default function Home() {
  return (
    <SandboxProvider>
      <ResizablePanel
        leftPanel={<Chat />}
        rightPanel={<Workbench />}
        defaultLeftWidth={30}
      />
    </SandboxProvider>
  );
}
