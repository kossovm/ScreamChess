'use client';

import { useGameStore } from '@/store/gameStore';

export default function MoveHistory() {
  const { history } = useGameStore();
  const pairs: { num: number; w?: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, w: history[i]?.san, b: history[i + 1]?.san });
  }

  return (
    <div className="card max-h-[300px] overflow-y-auto">
      <h3 className="font-semibold mb-3">Moves</h3>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">No moves yet.</p>
      ) : (
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
          {pairs.map((p) => (
            <div key={p.num} className="contents">
              <span className="text-gray-500">{p.num}.</span>
              <span>{p.w ?? '…'}</span>
              <span>{p.b ?? ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
