'use client'

import { type ReactNode } from 'react'

interface ParchmentSidebarProps {
  side: 'left' | 'right'
  children: ReactNode
  open?: boolean
}

/* Torn edge clip-path — jagged on ALL four edges */
const tornAllEdges = `polygon(
  /* ── top edge (left → right) ── */
  0% 3px, 3% 0px, 5% 3px, 8% 1px, 11% 4px, 14% 0px, 17% 3px,
  20% 1px, 23% 4px, 26% 0px, 29% 3px, 32% 1px, 35% 4px,
  38% 0px, 41% 3px, 44% 1px, 47% 4px, 50% 0px, 53% 3px,
  56% 1px, 59% 4px, 62% 0px, 65% 3px, 68% 1px, 71% 4px,
  74% 0px, 77% 3px, 80% 1px, 83% 4px, 86% 0px, 89% 3px,
  92% 1px, 95% 4px, 98% 0px, 100% 3px,
  /* ── right edge (top → bottom) ── */
  calc(100% - 3px) 3%, 100% 5%, calc(100% - 2px) 8%, 100% 11%,
  calc(100% - 4px) 14%, 100% 17%, calc(100% - 2px) 20%, 100% 23%,
  calc(100% - 3px) 26%, 100% 29%, calc(100% - 4px) 32%, 100% 35%,
  calc(100% - 2px) 38%, 100% 41%, calc(100% - 3px) 44%, 100% 47%,
  calc(100% - 4px) 50%, 100% 53%, calc(100% - 2px) 56%, 100% 59%,
  calc(100% - 3px) 62%, 100% 65%, calc(100% - 4px) 68%, 100% 71%,
  calc(100% - 2px) 74%, 100% 77%, calc(100% - 3px) 80%, 100% 83%,
  calc(100% - 4px) 86%, 100% 89%, calc(100% - 2px) 92%, 100% 95%,
  calc(100% - 3px) 98%,
  /* ── bottom edge (right → left) ── */
  100% calc(100% - 3px), 97% 100%, 94% calc(100% - 3px), 91% 100%,
  88% calc(100% - 4px), 85% 100%, 82% calc(100% - 2px), 79% 100%,
  76% calc(100% - 3px), 73% 100%, 70% calc(100% - 4px), 67% 100%,
  64% calc(100% - 2px), 61% 100%, 58% calc(100% - 3px), 55% 100%,
  52% calc(100% - 4px), 49% 100%, 46% calc(100% - 2px), 43% 100%,
  40% calc(100% - 3px), 37% 100%, 34% calc(100% - 4px), 31% 100%,
  28% calc(100% - 2px), 25% 100%, 22% calc(100% - 3px), 19% 100%,
  16% calc(100% - 4px), 13% 100%, 10% calc(100% - 2px), 7% 100%,
  4% calc(100% - 3px), 1% 100%, 0% calc(100% - 3px),
  /* ── left edge (bottom → top) ── */
  3px 97%, 0% 94%, 2px 91%, 0% 88%,
  4px 85%, 0% 82%, 2px 79%, 0% 76%,
  3px 73%, 0% 70%, 4px 67%, 0% 64%,
  2px 61%, 0% 58%, 3px 55%, 0% 52%,
  4px 49%, 0% 46%, 2px 43%, 0% 40%,
  3px 37%, 0% 34%, 4px 31%, 0% 28%,
  2px 25%, 0% 22%, 3px 19%, 0% 16%,
  4px 13%, 0% 10%, 2px 7%, 0% 4%
)`

export function ParchmentSidebar({ side, children, open = true }: ParchmentSidebarProps) {
  const isLeft = side === 'left'

  return (
    <div
      className={`fixed z-20 flex flex-col rounded ${
        isLeft
          ? 'left-4 top-4 bottom-4 w-[300px]'
          : 'right-4 top-4 h-[50vh] w-[300px]'
      } ${open ? 'translate-x-0' : isLeft ? '-translate-x-[calc(100%+16px)]' : 'translate-x-[calc(100%+16px)]'}`}
      style={{
        background: 'linear-gradient(180deg, #e8cdb0 0%, #dfc09a 50%, #d4b896 100%)',
        clipPath: tornAllEdges,
        boxShadow: isLeft
          ? '4px 0 16px rgba(59, 50, 40, 0.2)'
          : '-4px 0 16px rgba(59, 50, 40, 0.2)',
        color: '#2a1f18',
      }}
    >
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
