// This layout can be used for game-specific global UI, like a minimal header or footer for game rooms.
// For now, it will just pass children through, but ensures game rooms are within this group.

import type { ReactNode } from 'react';

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-full flex-grow flex flex-col">
      {children}
    </div>
  );
}
