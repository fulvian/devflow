import type { MemoryBlock } from '@devflow/shared';

const ARCH_KEYWORDS = [/decision/i, /architecture/i, /design/i, /policy/i, /trade-?off/i];

export function detectImportant(blocks: MemoryBlock[]): MemoryBlock[] {
  return blocks.map(b => {
    const hits = ARCH_KEYWORDS.reduce((acc, rx) => acc + (rx.test(b.content) ? 1 : 0), 0);
    const score = Math.min(1, (b.importanceScore ?? 0.5) + hits * 0.1);
    return { ...b, importanceScore: score };
  });
}

